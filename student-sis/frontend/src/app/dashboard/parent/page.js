'use client';
import { useQuery } from 'react-query';
import { QueryClient, QueryClientProvider } from 'react-query';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { parentApi } from '@/lib/api';
import Link from 'next/link';
import { format } from 'date-fns';

const queryClient = new QueryClient();

function GradeChip({ score, letterGrade, maxPoints }) {
  const grade = letterGrade || (score !== null && score !== undefined ? `${score}${maxPoints ? `/${maxPoints}` : ''}` : '—');
  const color = letterGrade === 'A' || letterGrade === 'A+' ? 'bg-green-100 text-green-700'
    : letterGrade === 'B' ? 'bg-blue-100 text-blue-700'
    : letterGrade === 'C' ? 'bg-yellow-100 text-yellow-700'
    : letterGrade === 'D' || letterGrade === 'F' ? 'bg-red-100 text-red-700'
    : 'bg-gray-100 text-gray-700';
  return <span className={`badge ${color}`}>{grade}</span>;
}

function ParentDashboardContent() {
  const { data, isLoading } = useQuery('parent-dashboard', () => parentApi.dashboard().then(r => r.data), {
    refetchInterval: 60000,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-700" /></div>;
  }

  const { children = [], recentGrades = [], recentAttendance = [], announcements = [], unreadMessages = 0 } = data || {};
  const today = format(new Date(), 'EEEE, MMMM d, yyyy');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parent Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">{today}</p>
        </div>
        {unreadMessages > 0 && (
          <Link href="/dashboard/messages" className="flex items-center gap-2 bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-800">
            💬 {unreadMessages} unread message{unreadMessages > 1 ? 's' : ''}
          </Link>
        )}
      </div>

      {/* Children cards */}
      {children.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">👧</div>
          <h3 className="font-semibold text-gray-900">No children linked</h3>
          <p className="text-gray-500 text-sm mt-1">Contact your school administrator to link your children to your account.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {children.map(child => (
            <Link key={child.id} href={`/dashboard/parent/children?studentId=${child.id}`}>
              <div className="card hover:shadow-md transition-shadow cursor-pointer border-2 border-transparent hover:border-primary-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-lg font-bold text-primary-700">
                    {child.firstName[0]}{child.lastName[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{child.firstName} {child.lastName}</div>
                    <div className="text-sm text-gray-500">Grade {child.gradeLevel === 'K' ? 'Kindergarten' : child.gradeLevel}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="text-gray-500 text-xs">Classes</div>
                    <div className="font-semibold">{child.enrollments?.length || 0}</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="text-gray-500 text-xs">Student #</div>
                    <div className="font-semibold font-mono text-xs">{child.studentNumber}</div>
                  </div>
                </div>
                {(child.iep || child.ell || child.gifted) && (
                  <div className="flex gap-1 mt-3">
                    {child.iep && <span className="badge bg-purple-100 text-purple-700">IEP</span>}
                    {child.ell && <span className="badge bg-orange-100 text-orange-700">ELL</span>}
                    {child.gifted && <span className="badge bg-yellow-100 text-yellow-700">GT</span>}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent grades */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">📝 Recent Grades</h3>
          </div>
          {recentGrades.length === 0 ? (
            <p className="text-sm text-gray-500">No grades recorded yet</p>
          ) : (
            <div className="space-y-2">
              {recentGrades.slice(0, 8).map(g => (
                <div key={g.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex-1 min-w-0 mr-2">
                    <div className="text-sm font-medium truncate">{g.assignment?.title || 'Term Grade'}</div>
                    <div className="text-xs text-gray-500 truncate">{g.student?.firstName} · {g.class?.subject}</div>
                  </div>
                  <GradeChip score={g.score} letterGrade={g.letterGrade} maxPoints={g.assignment?.maxPoints} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent attendance alerts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">📅 Attendance Alerts</h3>
          </div>
          {recentAttendance.length === 0 ? (
            <div className="flex flex-col items-center py-4">
              <span className="text-3xl mb-2">🎉</span>
              <p className="text-sm text-green-700 font-medium">No absences in last 30 days!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentAttendance.map(a => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="text-sm font-medium">{a.student?.firstName} {a.student?.lastName}</div>
                    <div className="text-xs text-gray-500">{a.class?.name} · {format(new Date(a.date), 'MMM d')}</div>
                  </div>
                  <span className={`badge ${a.status === 'ABSENT' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {a.status === 'ABSENT' ? 'Absent' : 'Late'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">📢 School Announcements</h3>
          <div className="space-y-3">
            {announcements.map(a => (
              <div key={a.id} className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-blue-900">{a.title}</div>
                  <div className="text-xs text-blue-600 flex-shrink-0">{a.publishedAt ? format(new Date(a.publishedAt), 'MMM d') : ''}</div>
                </div>
                <p className="text-sm text-blue-800 mt-1">{a.body}</p>
                <div className="text-xs text-blue-600 mt-2">— {a.author?.firstName} {a.author?.lastName}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ParentDashboardPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardLayout requiredRole="PARENT">
        <ParentDashboardContent />
      </DashboardLayout>
    </QueryClientProvider>
  );
}
