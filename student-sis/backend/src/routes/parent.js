const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireEmailVerified } = require('../middleware/rbac');

router.use(authenticate, requireEmailVerified, requireRole('PARENT'));

// ─── GET /api/parent/dashboard ────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  const parent = await prisma.parent.findUnique({
    where: { userId: req.user.id },
    include: {
      students: {
        include: {
          student: {
            include: {
              enrollments: {
                where: { isActive: true },
                include: { class: { select: { id: true, name: true, subject: true, teacher: { include: { user: { select: { firstName: true, lastName: true } } } } } } },
              },
            },
          },
        },
      },
    },
  });

  if (!parent) return res.status(404).json({ error: 'Parent profile not found' });

  const studentIds = parent.students.map(ps => ps.studentId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [recentGrades, recentAttendance, announcements, unreadMessages] = await Promise.all([
    prisma.grade.findMany({
      where: { studentId: { in: studentIds } },
      orderBy: { gradedAt: 'desc' },
      take: 20,
      include: {
        student: { select: { firstName: true, lastName: true } },
        class: { select: { name: true, subject: true } },
        assignment: { select: { title: true, maxPoints: true } },
      },
    }),
    prisma.attendance.findMany({
      where: {
        studentId: { in: studentIds },
        date: { gte: thirtyDaysAgo },
        status: { in: ['ABSENT', 'LATE'] },
      },
      orderBy: { date: 'desc' },
      take: 10,
      include: {
        student: { select: { firstName: true, lastName: true } },
        class: { select: { name: true } },
      },
    }),
    prisma.announcement.findMany({
      where: {
        schoolId: req.user.schoolId,
        targetRoles: { has: 'PARENT' },
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
      orderBy: { publishedAt: 'desc' },
      take: 5,
      include: { author: { select: { firstName: true, lastName: true } } },
    }),
    prisma.message.count({ where: { recipientId: req.user.id, isRead: false } }),
  ]);

  res.json({
    children: parent.students.map(ps => ({
      ...ps.student,
      relationship: ps.relationship,
      isPrimary: ps.isPrimary,
    })),
    recentGrades,
    recentAttendance,
    announcements,
    unreadMessages,
  });
});

// ─── GET /api/parent/children ─────────────────────────────────────────────────
router.get('/children', async (req, res) => {
  const parent = await prisma.parent.findUnique({
    where: { userId: req.user.id },
    include: {
      students: {
        include: {
          student: {
            include: {
              enrollments: {
                where: { isActive: true },
                include: { class: { include: { teacher: { include: { user: { select: { firstName: true, lastName: true } } } } } } },
              },
              emergencyContacts: true,
            },
          },
        },
      },
    },
  });
  if (!parent) return res.json([]);
  res.json(parent.students.map(ps => ({ ...ps.student, relationship: ps.relationship })));
});

module.exports = router;
