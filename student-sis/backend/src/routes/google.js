const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireEmailVerified } = require('../middleware/rbac');
const googleService = require('../services/googleService');
const { logger } = require('../utils/logger');

router.use(authenticate, requireEmailVerified);

// ─── GET /api/google/auth-url ─────────────────────────────────────────────────
// Returns Google OAuth URL for user to authorize
router.get('/auth-url', (req, res) => {
  const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString('base64url');
  const url = googleService.getAuthUrl(state);
  res.json({ url });
});

// ─── GET /api/google/callback ─────────────────────────────────────────────────
// OAuth2 callback - exchange code for tokens
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${process.env.FRONTEND_URL}/settings?google=error`);
  }

  try {
    const { userId } = JSON.parse(Buffer.from(state, 'base64url').toString());
    const tokens = await googleService.exchangeCode(code);
    const userInfo = await googleService.getUserInfo(tokens);

    // Verify Google domain matches school's allowed domains
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { school: { select: { googleDomains: true } } },
    });

    const domain = userInfo.email?.split('@')[1];
    if (user.school.googleDomains.length > 0 && !user.school.googleDomains.includes(domain)) {
      return res.redirect(`${process.env.FRONTEND_URL}/settings?google=domain-mismatch`);
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        googleId: userInfo.id,
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token || undefined,
      },
    });

    return res.redirect(`${process.env.FRONTEND_URL}/settings?google=connected`);
  } catch (err) {
    logger.error('Google callback error:', err);
    return res.redirect(`${process.env.FRONTEND_URL}/settings?google=error`);
  }
});

// ─── GET /api/google/classroom/courses ───────────────────────────────────────
router.get('/classroom/courses', async (req, res) => {
  try {
    const courses = await googleService.getClassroomCourses(req.user.id);
    res.json(courses);
  } catch (err) {
    if (err.message === 'Google not connected') {
      return res.status(400).json({ error: 'Connect your Google account first' });
    }
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// ─── POST /api/google/classroom/sync ─────────────────────────────────────────
router.post('/classroom/sync', async (req, res) => {
  const { courseId, classId } = req.body;
  try {
    const students = await googleService.syncClassroomRoster(req.user.id, courseId, classId);
    res.json({ synced: students.length, students });
  } catch (err) {
    res.status(500).json({ error: 'Sync failed' });
  }
});

// ─── DELETE /api/google/disconnect ───────────────────────────────────────────
router.delete('/disconnect', async (req, res) => {
  await prisma.user.update({
    where: { id: req.user.id },
    data: { googleId: null, googleAccessToken: null, googleRefreshToken: null },
  });
  res.json({ message: 'Google account disconnected' });
});

module.exports = router;
