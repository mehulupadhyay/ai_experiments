const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/database');
const redis = require('../config/redis');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const { generateInviteToken, verifyInviteToken } = require('../utils/invite');
const { sendVerificationEmail, sendInviteEmail, sendPasswordResetEmail } = require('../services/emailService');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logger } = require('../utils/logger');

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many attempts' } });

// ─── Validation helpers ───────────────────────────────────────────────────────
function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return false;
  }
  return true;
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    if (!user.isActive) return res.status(403).json({ error: 'Account disabled' });

    const accessToken  = signAccess({ sub: user.id, role: user.role, schoolId: user.schoolId });
    const refreshToken = signRefresh({ sub: user.id });

    // Store refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({ data: { userId: user.id, token: refreshToken, expiresAt } });
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      accessToken,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, schoolId: user.schoolId, emailVerified: user.emailVerified },
    });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── POST /api/auth/register (via invite token) ───────────────────────────────
router.post('/register', authLimiter, [
  body('token').notEmpty(),
  body('firstName').trim().isLength({ min: 1, max: 50 }),
  body('lastName').trim().isLength({ min: 1, max: 50 }),
  body('password').isStrongPassword({ minLength: 8, minNumbers: 1, minSymbols: 1 }),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { token, firstName, lastName, password } = req.body;

    const invite = await prisma.invite.findUnique({ where: { token } });
    if (!invite || invite.status !== 'PENDING') {
      return res.status(400).json({ error: 'Invalid or expired invitation' });
    }
    if (new Date() > invite.expiresAt) {
      await prisma.invite.update({ where: { id: invite.id }, data: { status: 'EXPIRED' } });
      return res.status(400).json({ error: 'Invitation has expired' });
    }
    if (!verifyInviteToken(token)) {
      return res.status(400).json({ error: 'Invalid invitation token' });
    }

    // Check email not already registered
    const existing = await prisma.user.findUnique({ where: { email: invite.email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const verifyToken = crypto.randomBytes(32).toString('hex');

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          schoolId: invite.schoolId,
          email: invite.email,
          passwordHash,
          firstName,
          lastName,
          role: invite.role,
        },
      });

      // Create role profile
      if (invite.role === 'TEACHER') {
        await tx.teacher.create({ data: { userId: newUser.id } });
      } else if (invite.role === 'PARENT') {
        const parent = await tx.parent.create({ data: { userId: newUser.id } });
        // Link to student if metadata contains studentId
        if (invite.metadata?.studentId) {
          await tx.parentStudent.create({
            data: { parentId: parent.id, studentId: invite.metadata.studentId, relationship: invite.metadata.relationship || 'Parent' },
          });
        }
      }

      await tx.invite.update({ where: { id: invite.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
      return newUser;
    });

    // Cache verification token
    await redis.setex(`verify:${verifyToken}`, 86400, user.id);
    await sendVerificationEmail(user.email, verifyToken);

    return res.status(201).json({ message: 'Account created. Check your email to verify.' });
  } catch (err) {
    logger.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ─── GET /api/auth/verify-email ───────────────────────────────────────────────
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });
  try {
    const userId = await redis.get(`verify:${token}`);
    if (!userId) return res.status(400).json({ error: 'Invalid or expired token' });

    await prisma.user.update({ where: { id: userId }, data: { emailVerified: true, emailVerifiedAt: new Date() } });
    await redis.del(`verify:${token}`);

    return res.json({ message: 'Email verified successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const token = req.cookies.refreshToken || req.body.refreshToken;
  if (!token) return res.status(401).json({ error: 'Refresh token required' });

  try {
    const payload = verifyRefresh(token);
    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || new Date() > stored.expiresAt) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user?.isActive) return res.status(401).json({ error: 'User inactive' });

    const accessToken = signAccess({ sub: user.id, role: user.role, schoolId: user.schoolId });
    return res.json({ accessToken });
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', authenticate, async (req, res) => {
  try {
    // Blacklist current access token (TTL = 15 min)
    await redis.setex(`bl:${req.token}`, 900, '1');
    // Delete refresh token
    const rt = req.cookies.refreshToken;
    if (rt) {
      await prisma.refreshToken.deleteMany({ where: { token: rt } });
    }
    res.clearCookie('refreshToken');
    return res.json({ message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
router.post('/forgot-password', authLimiter, [body('email').isEmail().normalizeEmail()], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    // Always return success to prevent email enumeration
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      await redis.setex(`reset:${token}`, 3600, user.id);
      await sendPasswordResetEmail(user.email, token);
    }
    return res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
router.post('/reset-password', authLimiter, [
  body('token').notEmpty(),
  body('password').isStrongPassword({ minLength: 8, minNumbers: 1, minSymbols: 1 }),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { token, password } = req.body;
    const userId = await redis.get(`reset:${token}`);
    if (!userId) return res.status(400).json({ error: 'Invalid or expired token' });

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await redis.del(`reset:${token}`);
    // Revoke all refresh tokens
    await prisma.refreshToken.deleteMany({ where: { userId } });

    return res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Reset failed' });
  }
});

// ─── POST /api/auth/invite (admin sends invite) ───────────────────────────────
router.post('/invite', authenticate, requireRole('SCHOOL_ADMIN'), [
  body('email').isEmail().normalizeEmail(),
  body('role').isIn(['TEACHER', 'PARENT', 'SCHOOL_ADMIN']),
  body('metadata').optional().isObject(),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { email, role, metadata } = req.body;
    const school = await prisma.school.findUnique({ where: { id: req.user.schoolId } });

    // Invalidate any existing pending invites for this email+school
    await prisma.invite.updateMany({
      where: { email, schoolId: req.user.schoolId, status: 'PENDING' },
      data: { status: 'REVOKED' },
    });

    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.invite.create({
      data: {
        schoolId: req.user.schoolId,
        sentById: req.user.id,
        email,
        role,
        token,
        expiresAt,
        metadata,
      },
    });

    const inviterName = `${req.user.firstName} ${req.user.lastName}`;
    await sendInviteEmail(email, role, inviterName, token, school.name);

    return res.json({ message: `Invitation sent to ${email}` });
  } catch (err) {
    logger.error('Invite error:', err);
    res.status(500).json({ error: 'Failed to send invite' });
  }
});

// ─── GET /api/auth/invite/:token (validate before registration) ───────────────
router.get('/invite/:token', async (req, res) => {
  try {
    const invite = await prisma.invite.findUnique({
      where: { token: req.params.token },
      include: { school: { select: { name: true, logoUrl: true } } },
    });

    if (!invite || invite.status !== 'PENDING') {
      return res.status(400).json({ error: 'Invalid or expired invitation' });
    }
    if (new Date() > invite.expiresAt) {
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    return res.json({
      email: invite.email,
      role: invite.role,
      schoolName: invite.school.name,
      schoolLogoUrl: invite.school.logoUrl,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to validate invite' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
