const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create demo school
  const school = await prisma.school.upsert({
    where: { email: 'admin@demo-school.edu' },
    update: {},
    create: {
      name: 'Demo Academy',
      email: 'admin@demo-school.edu',
      address: '123 Education Blvd',
      city: 'Springfield',
      state: 'IL',
      zipCode: '62701',
      gradeLevels: ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
      settings: {
        create: {
          gradeType: 'LETTER',
          passingGrade: 60,
          attendanceNotify: true,
          parentPortalEnabled: true,
          studentPortalEnabled: true,
        },
      },
    },
  });

  // Create academic year
  const academicYear = await prisma.academicYear.upsert({
    where: { id: 'ay-2024-2025' },
    update: {},
    create: {
      id: 'ay-2024-2025',
      schoolId: school.id,
      name: '2024-2025',
      startDate: new Date('2024-08-26'),
      endDate: new Date('2025-06-06'),
      isCurrent: true,
    },
  });

  // Create terms
  await prisma.term.createMany({
    skipDuplicates: true,
    data: [
      { id: 'q1-2024', academicYearId: academicYear.id, name: 'Q1', startDate: new Date('2024-08-26'), endDate: new Date('2024-11-01'), isCurrent: false },
      { id: 'q2-2024', academicYearId: academicYear.id, name: 'Q2', startDate: new Date('2024-11-04'), endDate: new Date('2025-01-17'), isCurrent: true },
      { id: 'q3-2025', academicYearId: academicYear.id, name: 'Q3', startDate: new Date('2025-01-21'), endDate: new Date('2025-03-28'), isCurrent: false },
      { id: 'q4-2025', academicYearId: academicYear.id, name: 'Q4', startDate: new Date('2025-03-31'), endDate: new Date('2025-06-06'), isCurrent: false },
    ],
  });

  // Create admin user
  const adminHash = await bcrypt.hash('Admin@123456', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo-school.edu' },
    update: {},
    create: {
      schoolId: school.id,
      email: 'admin@demo-school.edu',
      passwordHash: adminHash,
      firstName: 'School',
      lastName: 'Admin',
      role: 'SCHOOL_ADMIN',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  console.log('Seed complete. Admin login: admin@demo-school.edu / Admin@123456');
  console.log('School ID:', school.id);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
