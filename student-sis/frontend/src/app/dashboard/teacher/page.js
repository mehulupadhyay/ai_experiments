'use client';
import { useQuery } from 'react-query';
import { QueryClient, QueryClientProvider } from 'react-query';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { teacherApi } from '@/lib/api';
import Link from 'next/link';
import { format } from 'date-fns';

const queryClient = new QueryClient();

function AttendanceBadge({ taken }) {
  return taken
    ? <span className="badge bg-green-100 text-green-700">✓ Done</span>
    : <span className="badge bg-red-100 text-red-700">Pending</span>;
}

function TeacherDashboardContent() {
  const { data, isLoading } = useQuery('teacher-dashboard', () => teacherApi.dashboard().then(r => r.data), {
    refetchInterval: 60000,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-700" /></div>;
  }

  const { classes = [], upcomingDue = [], recentGrades = [], atRiskStudents = [] } = data || {};
  const today = format(new Date(), 'EEEE, MMMM d, yyyy');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">{today}</p>
      </div>

      {/* My Classes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">My Classes</h2>
          <Link href="/dashboard/teacher/classes" className="text-sm text-primary-700 hover:underline">View all</Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.length === 0 && (
            <div className="card col-span-full text-center text-gray-500 py-8">No classes assigned yet</div>
          )}
          {classes.map(cls => (
            <div key={cls.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-gray-900">{cls.name}</div>
                  <div className="text-sm text-gray-500">{cls.subject} · Grade {cls.gradeLevel}</div>
                  <div className="text-sm text-gray-500 mt-1">{cls._count?.enrollments || 0} students</div>
                </div>
                <AttendanceBadge taken={cls.attendanceTakenToday} />
              </div>
              <div className="flex gap-2 mt-4">
                <Link href={`/dashboard/teacher/attendance?classId=${cls.id}`} className="btn-primary text-xs flex-1 text-center py-1.5">
                  Take Attendance
                </Link>
                <Link href={`/dashboard/teacher/grades?classId=${cls.id}`} className="btn-secondary text-xs flex-1 text-center py-1.5">
                  Gradebook
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* At-risk students */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            ⚠️ At-Risk Students <span className="text-sm font-normal text-gray-500">(3+ absences)</span>
          </h3>
          {atRiskStudents.length === 0 ? (
            <p className="text-sm text-gray-500">No at-risk students 🎉</p>
          ) : (
            <div className="space-y-2">
              {atRiskStudents.slice(0, 8).map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <span className="text-sm font-medium">{s.first_name} {s.last_name}</span>
                    <span className="text-xs text-gray-400 ml-2">Gr. {s.grade_level}</span>
                  </div>
                  <span className="badge bg-red-100 text-red-700">{Number(s.absent_count)} absences</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming assignments */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">📅 Due This Week</h3>
          {upcomingDue.length === 0 ? (
            <p className="text-sm text-gray-500">No assignments due this week</p>
          ) : (
            <div className="space-y-2">
              {upcomingDue.map(a => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="text-sm font-medium">{a.title}</div>
                    <div className="text-xs text-gray-500">{a.class?.name}</div>
                  </div>
                  <div className="text-xs text-gray-500 text-right">
                    {a.dueDate ? format(new Date(a.dueDate), 'MMM d') : 'No date'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent grading activity */}
      {recentGrades.length > 0 && (
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">✏️ Recent Grading</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 border-b">
                <tr>
                  <th className="text-left pb-2">Student</th>
                  <th className="text-left pb-2">Class</th>
                  <th className="text-left pb-2">Assignment</th>
                  <th className="text-right pb-2">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentGrades.map(g => (
                  <tr key={g.id}>
                    <td className="py-2">{g.student?.firstName} {g.student?.lastName}</td>
                    <td className="py-2 text-gray-500">{g.class?.name}</td>
                    <td className="py-2 text-gray-500">{g.assignment?.title || 'Term grade'}</td>
                    <td className="py-2 text-right font-medium">
                      {g.letterGrade || (g.score !== null ? `${g.score}` : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeacherDashboardPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardLayout requiredRole="TEACHER">
        <TeacherDashboardContent />
      </DashboardLayout>
    </QueryClientProvider>
  );
}
