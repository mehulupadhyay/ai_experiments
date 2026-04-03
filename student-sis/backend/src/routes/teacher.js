const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireEmailVerified } = require('../middleware/rbac');

router.use(authenticate, requireEmailVerified, requireRole('TEACHER'));

// Teacher dashboard
router.get('/dashboard', async (req, res) => {
  const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
  if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [myClasses, todayAttendanceTaken, upcomingDue, recentGrades, atRiskStudents] = await Promise.all([
    prisma.class.findMany({
      where: { teacherId: teacher.id, schoolId: req.user.schoolId, isActive: true },
      include: { _count: { select: { enrollments: { where: { isActive: true } } } } },
    }),
    // Which classes have attendance taken today
    prisma.attendance.groupBy({
      by: ['classId'],
      where: { teacherId: teacher.id, date: { gte: today } },
    }),
    // Assignments due in next 7 days
    prisma.assignment.findMany({
      where: {
        class: { teacherId: teacher.id },
        dueDate: { gte: today, lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      },
      include: { class: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
      take: 10,
    }),
    prisma.grade.findMany({
      where: { class: { teacherId: teacher.id } },
      orderBy: { gradedAt: 'desc' },
      take: 10,
      include: {
        student: { select: { firstName: true, lastName: true } },
        class: { select: { name: true } },
        assignment: { select: { title: true } },
      },
    }),
    // Students with >2 absences in my classes
    prisma.$queryRaw`
      SELECT s.id, s.first_name, s.last_name, s.grade_level,
             COUNT(a.id) FILTER (WHERE a.status = 'ABSENT') as absent_count
      FROM students s
      INNER JOIN attendance a ON a.student_id = s.id
      INNER JOIN classes c ON c.id = a.class_id
      WHERE c.teacher_id = ${teacher.id}
        AND a.date >= NOW() - INTERVAL '30 days'
      GROUP BY s.id, s.first_name, s.last_name, s.grade_level
      HAVING COUNT(a.id) FILTER (WHERE a.status = 'ABSENT') >= 2
      ORDER BY absent_count DESC
      LIMIT 10
    `,
  ]);

  const attendanceTakenClassIds = new Set(todayAttendanceTaken.map(a => a.classId));

  res.json({
    teacher: { id: teacher.id, department: teacher.department, subjectsTeach: teacher.subjectsTeach },
    classes: myClasses.map(c => ({
      ...c,
      attendanceTakenToday: attendanceTakenClassIds.has(c.id),
    })),
    upcomingDue,
    recentGrades,
    atRiskStudents,
  });
});

// Teacher profile
router.get('/profile', async (req, res) => {
  const teacher = await prisma.teacher.findUnique({
    where: { userId: req.user.id },
    include: { user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true, phone: true } } },
  });
  res.json(teacher);
});

router.patch('/profile', async (req, res) => {
  const { department, subjectsTeach, certification } = req.body;
  const teacher = await prisma.teacher.update({
    where: { userId: req.user.id },
    data: { department, subjectsTeach, certification },
  });
  res.json(teacher);
});

module.exports = router;
