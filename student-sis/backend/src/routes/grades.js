const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireEmailVerified } = require('../middleware/rbac');

router.use(authenticate, requireEmailVerified);

// ─── GET /api/grades/class/:classId ──────────────────────────────────────────
router.get('/class/:classId', requireRole(['SCHOOL_ADMIN', 'TEACHER']), async (req, res) => {
  const { termId } = req.query;
  const cls = await prisma.class.findFirst({ where: { id: req.params.classId, schoolId: req.user.schoolId } });
  if (!cls) return res.status(404).json({ error: 'Class not found' });

  const grades = await prisma.grade.findMany({
    where: { classId: req.params.classId, ...(termId && { termId }) },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, studentNumber: true } },
      assignment: { select: { id: true, title: true, type: true, maxPoints: true, weight: true } },
    },
    orderBy: { student: { lastName: 'asc' } },
  });
  res.json(grades);
});

// ─── POST /api/grades ─────────────────────────────────────────────────────────
router.post('/', requireRole(['SCHOOL_ADMIN', 'TEACHER']), async (req, res) => {
  const { studentId, classId, assignmentId, termId, score, letterGrade, comment } = req.body;
  try {
    const grade = await prisma.grade.upsert({
      where: assignmentId
        ? { studentId_classId_assignmentId: { studentId, classId, assignmentId } }
        : { id: 'new' }, // term grade - just create
      create: { studentId, classId, assignmentId, termId, score, letterGrade, comment, gradedAt: new Date() },
      update: { score, letterGrade, comment, gradedAt: new Date() },
    });
    res.status(201).json(grade);
  } catch (err) {
    // Handle term grades (no unique constraint on term grades without assignment)
    const grade = await prisma.grade.create({
      data: { studentId, classId, assignmentId, termId, score, letterGrade, comment, gradedAt: new Date() },
    });
    res.status(201).json(grade);
  }
});

// ─── POST /api/grades/bulk ────────────────────────────────────────────────────
router.post('/bulk', requireRole(['SCHOOL_ADMIN', 'TEACHER']), async (req, res) => {
  const { classId, assignmentId, termId, grades } = req.body;
  // grades = [{ studentId, score, letterGrade, comment }]

  const cls = await prisma.class.findFirst({ where: { id: classId, schoolId: req.user.schoolId } });
  if (!cls) return res.status(404).json({ error: 'Class not found' });

  const ops = grades.map(({ studentId, score, letterGrade, comment }) =>
    prisma.grade.upsert({
      where: assignmentId
        ? { studentId_classId_assignmentId: { studentId, classId, assignmentId } }
        : { id: `grade-${studentId}-${classId}-${termId}` },
      create: { studentId, classId, assignmentId, termId, score, letterGrade, comment, gradedAt: new Date() },
      update: { score, letterGrade, comment, gradedAt: new Date() },
    })
  );

  try {
    const results = await prisma.$transaction(ops);
    res.json({ saved: results.length });
  } catch {
    // Fallback to individual creates
    const results = [];
    for (const g of grades) {
      const grade = await prisma.grade.create({
        data: { studentId: g.studentId, classId, assignmentId, termId, score: g.score, letterGrade: g.letterGrade, comment: g.comment, gradedAt: new Date() },
      });
      results.push(grade);
    }
    res.json({ saved: results.length });
  }
});

// ─── GET /api/grades/report-card/:studentId ───────────────────────────────────
router.get('/report-card/:studentId', async (req, res) => {
  const { termId } = req.query;

  // Parents can only view their own children
  if (req.user.role === 'PARENT') {
    const parent = await prisma.parent.findUnique({ where: { userId: req.user.id } });
    const linked = await prisma.parentStudent.findFirst({ where: { parentId: parent?.id, studentId: req.params.studentId } });
    if (!linked) return res.status(403).json({ error: 'Access denied' });
  }

  const student = await prisma.student.findFirst({
    where: { id: req.params.studentId, schoolId: req.user.schoolId },
  });
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const grades = await prisma.grade.findMany({
    where: { studentId: req.params.studentId, ...(termId && { termId }), assignmentId: null },
    include: {
      class: { select: { name: true, subject: true, teacher: { include: { user: { select: { firstName: true, lastName: true } } } } } },
      term: { select: { name: true } },
    },
  });

  res.json({ student, grades });
});

// ─── POST /api/grades/assignments ─────────────────────────────────────────────
router.post('/assignments', requireRole(['SCHOOL_ADMIN', 'TEACHER']), async (req, res) => {
  const { classId, title, description, type, dueDate, maxPoints, weight } = req.body;
  const cls = await prisma.class.findFirst({ where: { id: classId, schoolId: req.user.schoolId } });
  if (!cls) return res.status(404).json({ error: 'Class not found' });

  const assignment = await prisma.assignment.create({
    data: { classId, title, description, type, dueDate: dueDate ? new Date(dueDate) : null, maxPoints, weight: weight || 1.0 },
  });
  res.status(201).json(assignment);
});

router.get('/assignments/:classId', async (req, res) => {
  const cls = await prisma.class.findFirst({ where: { id: req.params.classId, schoolId: req.user.schoolId } });
  if (!cls) return res.status(404).json({ error: 'Class not found' });
  const assignments = await prisma.assignment.findMany({
    where: { classId: req.params.classId, isPublished: true },
    orderBy: { dueDate: 'asc' },
  });
  res.json(assignments);
});

module.exports = router;
