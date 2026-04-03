const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireEmailVerified } = require('../middleware/rbac');

router.use(authenticate, requireEmailVerified);

// Students accessible to admin + teachers
const adminOrTeacher = requireRole(['SCHOOL_ADMIN', 'TEACHER']);

// ─── GET /api/students ────────────────────────────────────────────────────────
router.get('/', adminOrTeacher, async (req, res) => {
  const { page = 1, limit = 20, search, gradeLevel, isActive = 'true' } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {
    schoolId: req.user.schoolId,
    isActive: isActive === 'true',
    ...(gradeLevel && { gradeLevel }),
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { studentNumber: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: {
        parents: { include: { parent: { include: { user: { select: { email: true, firstName: true, lastName: true, phone: true } } } } } },
      },
    }),
    prisma.student.count({ where }),
  ]);

  res.json({ students, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
});

// ─── POST /api/students ───────────────────────────────────────────────────────
router.post('/', requireRole('SCHOOL_ADMIN'), [
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('gradeLevel').notEmpty(),
  body('studentNumber').optional().trim(),
  body('dateOfBirth').optional().isISO8601(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const {
      firstName, lastName, gradeLevel, studentNumber, dateOfBirth,
      gender, address, city, state, zipCode, notes, iep, ell, gifted,
    } = req.body;

    // Auto-generate student number if not provided
    const count = await prisma.student.count({ where: { schoolId: req.user.schoolId } });
    const autoNumber = studentNumber || `STU${String(count + 1).padStart(5, '0')}`;

    const student = await prisma.student.create({
      data: {
        schoolId: req.user.schoolId,
        firstName,
        lastName,
        gradeLevel,
        studentNumber: autoNumber,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender, address, city, state, zipCode, notes,
        iep: iep || false,
        ell: ell || false,
        gifted: gifted || false,
      },
    });

    res.status(201).json(student);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Student number already exists' });
    res.status(500).json({ error: 'Failed to create student' });
  }
});

// ─── GET /api/students/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const student = await prisma.student.findFirst({
    where: { id: req.params.id, schoolId: req.user.schoolId },
    include: {
      parents: { include: { parent: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } } } } } },
      enrollments: { where: { isActive: true }, include: { class: { include: { teacher: { include: { user: { select: { firstName: true, lastName: true } } } } } } } },
      emergencyContacts: true,
      healthRecords: { orderBy: { createdAt: 'desc' } },
      documents: { orderBy: { uploadedAt: 'desc' } },
    },
  });

  if (!student) return res.status(404).json({ error: 'Student not found' });

  // Parents can only see their own children
  if (req.user.role === 'PARENT') {
    const parent = await prisma.parent.findUnique({ where: { userId: req.user.id } });
    const linked = await prisma.parentStudent.findFirst({ where: { parentId: parent?.id, studentId: student.id } });
    if (!linked) return res.status(403).json({ error: 'Access denied' });
  }

  res.json(student);
});

// ─── PATCH /api/students/:id ──────────────────────────────────────────────────
router.patch('/:id', requireRole('SCHOOL_ADMIN'), async (req, res) => {
  try {
    const { firstName, lastName, gradeLevel, gender, address, city, state, zipCode, notes, iep, ell, gifted, isActive } = req.body;
    const student = await prisma.student.update({
      where: { id: req.params.id, schoolId: req.user.schoolId },
      data: { firstName, lastName, gradeLevel, gender, address, city, state, zipCode, notes, iep, ell, gifted, isActive },
    });
    res.json(student);
  } catch {
    res.status(404).json({ error: 'Student not found' });
  }
});

// ─── GET /api/students/:id/grades ─────────────────────────────────────────────
router.get('/:id/grades', async (req, res) => {
  const { termId } = req.query;
  const grades = await prisma.grade.findMany({
    where: {
      studentId: req.params.id,
      class: { schoolId: req.user.schoolId },
      ...(termId && { termId }),
    },
    include: {
      class: { select: { name: true, subject: true } },
      assignment: { select: { title: true, type: true, maxPoints: true, weight: true } },
      term: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(grades);
});

// ─── GET /api/students/:id/attendance ─────────────────────────────────────────
router.get('/:id/attendance', async (req, res) => {
  const { from, to } = req.query;
  const attendance = await prisma.attendance.findMany({
    where: {
      studentId: req.params.id,
      class: { schoolId: req.user.schoolId },
      ...(from && { date: { gte: new Date(from) } }),
      ...(to && { date: { lte: new Date(to) } }),
    },
    include: { class: { select: { name: true, subject: true } } },
    orderBy: { date: 'desc' },
  });
  res.json(attendance);
});

// ─── POST /api/students/:id/emergency-contacts ────────────────────────────────
router.post('/:id/emergency-contacts', requireRole('SCHOOL_ADMIN'), async (req, res) => {
  const { name, relationship, phone, email, isPrimary } = req.body;
  const contact = await prisma.emergencyContact.create({
    data: { studentId: req.params.id, name, relationship, phone, email, isPrimary: isPrimary || false },
  });
  res.status(201).json(contact);
});

// ─── POST /api/students/:id/health-records ────────────────────────────────────
router.post('/:id/health-records', requireRole('SCHOOL_ADMIN'), async (req, res) => {
  const { type, description, date, expiresAt, notes } = req.body;
  const record = await prisma.healthRecord.create({
    data: {
      studentId: req.params.id,
      type, description,
      date: date ? new Date(date) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      notes,
    },
  });
  res.status(201).json(record);
});

module.exports = router;
