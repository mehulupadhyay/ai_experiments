const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireEmailVerified } = require('../middleware/rbac');
const { sendAttendanceAlert } = require('../services/emailService');
const { logger } = require('../utils/logger');

router.use(authenticate, requireEmailVerified);

// ─── POST /api/attendance/bulk ────────────────────────────────────────────────
// Teacher submits attendance for entire class
router.post('/bulk', requireRole(['SCHOOL_ADMIN', 'TEACHER']), async (req, res) => {
  const { classId, date, records } = req.body;
  // records = [{ studentId, status, notes }]

  if (!classId || !date || !Array.isArray(records)) {
    return res.status(400).json({ error: 'classId, date, and records required' });
  }

  // Verify class belongs to school
  const cls = await prisma.class.findFirst({ where: { id: classId, schoolId: req.user.schoolId } });
  if (!cls) return res.status(404).json({ error: 'Class not found' });

  try {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });

    // Upsert all records
    const ops = records.map(({ studentId, status, notes }) =>
      prisma.attendance.upsert({
        where: { studentId_classId_date: { studentId, classId, date: new Date(date) } },
        create: {
          studentId, classId, date: new Date(date), status, notes,
          teacherId: teacher?.id,
        },
        update: { status, notes, teacherId: teacher?.id },
      })
    );
    const created = await prisma.$transaction(ops);

    // Send absent notifications asynchronously
    const absences = records.filter(r => r.status === 'ABSENT' || r.status === 'LATE');
    for (const { studentId, status } of absences) {
      notifyParents(studentId, cls.name, date, status).catch(err =>
        logger.error('Attendance notify error:', err)
      );
    }

    res.json({ saved: created.length });
  } catch (err) {
    logger.error('Bulk attendance error:', err);
    res.status(500).json({ error: 'Failed to save attendance' });
  }
});

async function notifyParents(studentId, className, date, status) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      parents: {
        include: { parent: { include: { user: { select: { email: true } } } } },
      },
    },
  });

  if (!student) return;

  const parentEmails = student.parents.map(ps => ps.parent.user.email).filter(Boolean);
  const name = `${student.firstName} ${student.lastName}`;
  const dateStr = new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  for (const email of parentEmails) {
    await sendAttendanceAlert(email, name, dateStr, status, className);
    // Mark notification sent
    await prisma.attendance.updateMany({
      where: { studentId, class: { name: className }, date: new Date(date) },
      data: { notifiedAt: new Date() },
    });
  }
}

// ─── GET /api/attendance/class/:classId ───────────────────────────────────────
router.get('/class/:classId', requireRole(['SCHOOL_ADMIN', 'TEACHER']), async (req, res) => {
  const { date, from, to } = req.query;
  const cls = await prisma.class.findFirst({ where: { id: req.params.classId, schoolId: req.user.schoolId } });
  if (!cls) return res.status(404).json({ error: 'Class not found' });

  const where = {
    classId: req.params.classId,
    ...(date && { date: new Date(date) }),
    ...(from && to && { date: { gte: new Date(from), lte: new Date(to) } }),
  };

  const records = await prisma.attendance.findMany({
    where,
    include: { student: { select: { id: true, firstName: true, lastName: true, studentNumber: true } } },
    orderBy: [{ date: 'desc' }, { student: { lastName: 'asc' } }],
  });

  res.json(records);
});

// ─── GET /api/attendance/summary ──────────────────────────────────────────────
// Admin: school-wide summary by date range
router.get('/summary', requireRole(['SCHOOL_ADMIN', 'TEACHER']), async (req, res) => {
  const { from, to } = req.query;
  const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = to ? new Date(to) : new Date();

  const summary = await prisma.attendance.groupBy({
    by: ['status'],
    where: {
      student: { schoolId: req.user.schoolId },
      date: { gte: startDate, lte: endDate },
    },
    _count: true,
  });

  const total = summary.reduce((acc, s) => acc + s._count, 0);
  res.json({ summary, total, dateRange: { from: startDate, to: endDate } });
});

// ─── GET /api/attendance/at-risk ─────────────────────────────────────────────
// Students with > 3 absences in last 30 days (early intervention)
router.get('/at-risk', requireRole(['SCHOOL_ADMIN', 'TEACHER']), async (req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const atRisk = await prisma.$queryRaw`
    SELECT
      s.id,
      s.first_name,
      s.last_name,
      s.grade_level,
      s.student_number,
      COUNT(a.id) FILTER (WHERE a.status = 'ABSENT') as absent_count,
      COUNT(a.id) FILTER (WHERE a.status = 'LATE')   as late_count,
      COUNT(a.id) as total_checked
    FROM students s
    INNER JOIN attendance a ON a.student_id = s.id
    WHERE s.school_id = ${req.user.schoolId}
      AND s.is_active = true
      AND a.date >= ${thirtyDaysAgo}
    GROUP BY s.id, s.first_name, s.last_name, s.grade_level, s.student_number
    HAVING COUNT(a.id) FILTER (WHERE a.status = 'ABSENT') >= 3
    ORDER BY absent_count DESC
    LIMIT 50
  `;

  res.json(atRisk);
});

module.exports = router;
