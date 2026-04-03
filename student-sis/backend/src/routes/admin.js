const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireEmailVerified } = require('../middleware/rbac');
const { logger } = require('../utils/logger');

router.use(authenticate, requireEmailVerified, requireRole('SCHOOL_ADMIN'));

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalStudents,
      totalTeachers,
      totalParents,
      totalClasses,
      todayAttendance,
      pendingInvites,
      recentEnrollments,
      attendanceTrend,
    ] = await Promise.all([
      prisma.student.count({ where: { schoolId, isActive: true } }),
      prisma.teacher.count({ where: { user: { schoolId, isActive: true } } }),
      prisma.parent.count({ where: { user: { schoolId, isActive: true } } }),
      prisma.class.count({ where: { schoolId, isActive: true } }),
      prisma.attendance.groupBy({
        by: ['status'],
        where: { student: { schoolId }, date: { gte: today } },
        _count: true,
      }),
      prisma.invite.count({ where: { schoolId, status: 'PENDING' } }),
      prisma.student.findMany({
        where: { schoolId },
        orderBy: { enrollmentDate: 'desc' },
        take: 5,
        select: { id: true, firstName: true, lastName: true, gradeLevel: true, enrollmentDate: true },
      }),
      // Last 7 days attendance
      prisma.$queryRaw`
        SELECT DATE(date) as day, status, COUNT(*) as count
        FROM attendance
        INNER JOIN students ON students.id = attendance.student_id
        WHERE students.school_id = ${schoolId}
          AND date >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(date), status
        ORDER BY day
      `,
    ]);

    const attendanceMap = {};
    todayAttendance.forEach(({ status, _count }) => { attendanceMap[status] = _count; });

    res.json({
      stats: {
        totalStudents,
        totalTeachers,
        totalParents,
        totalClasses,
        pendingInvites,
        todayPresent: attendanceMap.PRESENT || 0,
        todayAbsent: attendanceMap.ABSENT || 0,
        todayLate: attendanceMap.LATE || 0,
      },
      recentEnrollments,
      attendanceTrend,
    });
  } catch (err) {
    logger.error('Admin dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// ─── School Settings ──────────────────────────────────────────────────────────
router.get('/school', async (req, res) => {
  const school = await prisma.school.findUnique({
    where: { id: req.user.schoolId },
    include: { settings: true },
  });
  res.json(school);
});

router.patch('/school', async (req, res) => {
  try {
    const { name, address, city, state, zipCode, phone, primaryColor, gradeLevels, timezone, settings } = req.body;
    const school = await prisma.school.update({
      where: { id: req.user.schoolId },
      data: {
        ...(name && { name }),
        ...(address && { address }),
        ...(city && { city }),
        ...(state && { state }),
        ...(zipCode && { zipCode }),
        ...(phone && { phone }),
        ...(primaryColor && { primaryColor }),
        ...(gradeLevels && { gradeLevels }),
        ...(timezone && { timezone }),
        ...(settings && {
          settings: {
            upsert: {
              create: settings,
              update: settings,
            },
          },
        }),
      },
      include: { settings: true },
    });
    res.json(school);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update school' });
  }
});

// ─── User Management ──────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  const { role, page = 1, limit = 20, search } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = {
    schoolId: req.user.schoolId,
    ...(role && { role }),
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' }, select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, lastLoginAt: true, createdAt: true } }),
    prisma.user.count({ where }),
  ]);
  res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
});

router.patch('/users/:id', async (req, res) => {
  const { isActive, role } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id, schoolId: req.user.schoolId },
      data: { ...(typeof isActive === 'boolean' && { isActive }), ...(role && { role }) },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
    });
    res.json(user);
  } catch {
    res.status(404).json({ error: 'User not found' });
  }
});

// ─── Invites ──────────────────────────────────────────────────────────────────
router.get('/invites', async (req, res) => {
  const invites = await prisma.invite.findMany({
    where: { schoolId: req.user.schoolId },
    orderBy: { createdAt: 'desc' },
    include: { sentBy: { select: { firstName: true, lastName: true } } },
  });
  res.json(invites);
});

router.delete('/invites/:id', async (req, res) => {
  try {
    await prisma.invite.update({
      where: { id: req.params.id, schoolId: req.user.schoolId },
      data: { status: 'REVOKED' },
    });
    res.json({ message: 'Invite revoked' });
  } catch {
    res.status(404).json({ error: 'Invite not found' });
  }
});

// ─── Academic Years ───────────────────────────────────────────────────────────
router.get('/academic-years', async (req, res) => {
  const years = await prisma.academicYear.findMany({
    where: { schoolId: req.user.schoolId },
    include: { terms: { orderBy: { startDate: 'asc' } } },
    orderBy: { startDate: 'desc' },
  });
  res.json(years);
});

router.post('/academic-years', async (req, res) => {
  const { name, startDate, endDate, terms } = req.body;
  try {
    const year = await prisma.academicYear.create({
      data: {
        schoolId: req.user.schoolId,
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        terms: terms ? { create: terms.map(t => ({ ...t, startDate: new Date(t.startDate), endDate: new Date(t.endDate) })) } : undefined,
      },
      include: { terms: true },
    });
    res.status(201).json(year);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create academic year' });
  }
});

// ─── Announcements ────────────────────────────────────────────────────────────
router.post('/announcements', async (req, res) => {
  const { title, body, targetRoles, publishedAt, expiresAt } = req.body;
  try {
    const ann = await prisma.announcement.create({
      data: {
        schoolId: req.user.schoolId,
        authorId: req.user.id,
        title,
        body,
        targetRoles: targetRoles || ['TEACHER', 'PARENT'],
        publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });
    res.status(201).json(ann);
  } catch {
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

router.get('/announcements', async (req, res) => {
  const announcements = await prisma.announcement.findMany({
    where: { schoolId: req.user.schoolId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { author: { select: { firstName: true, lastName: true } } },
  });
  res.json(announcements);
});

module.exports = router;
