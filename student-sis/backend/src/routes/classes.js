const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireEmailVerified } = require('../middleware/rbac');

router.use(authenticate, requireEmailVerified);

router.get('/', async (req, res) => {
  const { gradeLevel, subject, teacherId } = req.query;
  const classes = await prisma.class.findMany({
    where: {
      schoolId: req.user.schoolId,
      isActive: true,
      ...(gradeLevel && { gradeLevel }),
      ...(subject && { subject }),
      ...(teacherId && { teacherId }),
    },
    include: {
      teacher: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      _count: { select: { enrollments: { where: { isActive: true } } } },
    },
    orderBy: [{ gradeLevel: 'asc' }, { name: 'asc' }],
  });
  res.json(classes);
});

router.post('/', requireRole('SCHOOL_ADMIN'), async (req, res) => {
  const { name, subject, gradeLevel, teacherId, roomNumber, period, schedule, maxEnrollment } = req.body;
  try {
    const cls = await prisma.class.create({
      data: { schoolId: req.user.schoolId, name, subject, gradeLevel, teacherId, roomNumber, period, schedule, maxEnrollment: maxEnrollment || 30 },
      include: { teacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
    res.status(201).json(cls);
  } catch {
    res.status(500).json({ error: 'Failed to create class' });
  }
});

router.get('/:id', async (req, res) => {
  const cls = await prisma.class.findFirst({
    where: { id: req.params.id, schoolId: req.user.schoolId },
    include: {
      teacher: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
      enrollments: {
        where: { isActive: true },
        include: { student: { select: { id: true, firstName: true, lastName: true, studentNumber: true, gradeLevel: true } } },
      },
      assignments: { orderBy: { dueDate: 'asc' } },
    },
  });
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  res.json(cls);
});

router.patch('/:id', requireRole('SCHOOL_ADMIN'), async (req, res) => {
  const { name, subject, gradeLevel, teacherId, roomNumber, period, schedule, maxEnrollment, isActive } = req.body;
  try {
    const cls = await prisma.class.update({
      where: { id: req.params.id, schoolId: req.user.schoolId },
      data: { name, subject, gradeLevel, teacherId, roomNumber, period, schedule, maxEnrollment, isActive },
    });
    res.json(cls);
  } catch {
    res.status(404).json({ error: 'Class not found' });
  }
});

// Enroll student in class
router.post('/:id/enroll', requireRole(['SCHOOL_ADMIN', 'TEACHER']), async (req, res) => {
  const { studentId } = req.body;
  try {
    const enrollment = await prisma.enrollment.upsert({
      where: { studentId_classId: { studentId, classId: req.params.id } },
      create: { studentId, classId: req.params.id, isActive: true },
      update: { isActive: true, droppedAt: null },
    });
    res.json(enrollment);
  } catch {
    res.status(500).json({ error: 'Failed to enroll student' });
  }
});

// Drop student from class
router.delete('/:id/enroll/:studentId', requireRole(['SCHOOL_ADMIN']), async (req, res) => {
  await prisma.enrollment.update({
    where: { studentId_classId: { studentId: req.params.studentId, classId: req.params.id } },
    data: { isActive: false, droppedAt: new Date() },
  });
  res.json({ message: 'Student dropped from class' });
});

// Teacher's classes
router.get('/teacher/mine', requireRole('TEACHER'), async (req, res) => {
  const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
  if (!teacher) return res.json([]);
  const classes = await prisma.class.findMany({
    where: { teacherId: teacher.id, schoolId: req.user.schoolId, isActive: true },
    include: { _count: { select: { enrollments: { where: { isActive: true } } } } },
  });
  res.json(classes);
});

module.exports = router;
