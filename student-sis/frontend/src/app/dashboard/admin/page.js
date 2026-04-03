'use client';
import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { QueryClient, QueryClientProvider } from 'react-query';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { adminApi, authApi } from '@/lib/api';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import Link from 'next/link';
import toast from 'react-hot-toast';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const queryClient = new QueryClient();

function StatCard({ icon, label, value, color, href }) {
  const content = (
    <div className={`stat-card border-l-4 ${color} hover:shadow-md transition-shadow`}>
      <div className="text-3xl">{icon}</div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value ?? '—'}</div>
        <div className="text-sm text-gray-500">{label}</div>
      </div>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function InviteModal({ onClose, onSuccess }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('TEACHER');
  const [loading, setLoading] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.sendInvite({ email, role });
      toast.success(`Invite sent to ${email}`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Send Invitation</h3>
        <form onSubmit={send} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="input" placeholder="user@school.edu" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select value={role} onChange={e => setRole(e.target.value)} className="input">
              <option value="TEACHER">Teacher</option>
              <option value="PARENT">Parent</option>
              <option value="SCHOOL_ADMIN">School Admin</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Sending...' : 'Send Invite'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminDashboardContent() {
  const [showInvite, setShowInvite] = useState(false);
  const { data, isLoading, refetch } = useQuery('admin-dashboard', () => adminApi.dashboard().then(r => r.data), {
    refetchInterval: 30000,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-700" /></div>;
  }

  const { stats, recentEnrollments, attendanceTrend } = data || {};

  // Build attendance chart data
  const chartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      { label: 'Present', data: [0, 0, 0, 0, 0, 0, 0], backgroundColor: '#22c55e' },
      { label: 'Absent', data: [0, 0, 0, 0, 0, 0, 0], backgroundColor: '#ef4444' },
      { label: 'Late', data: [0, 0, 0, 0, 0, 0, 0], backgroundColor: '#f59e0b' },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">School Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="btn-primary">
          + Send Invite
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="👩‍🎓" label="Total Students" value={stats?.totalStudents} color="border-blue-500" href="/dashboard/admin/students" />
        <StatCard icon="👨‍🏫" label="Teachers" value={stats?.totalTeachers} color="border-green-500" href="/dashboard/admin/teachers" />
        <StatCard icon="👨‍👩‍👧" label="Parents" value={stats?.totalParents} color="border-purple-500" />
        <StatCard icon="📚" label="Active Classes" value={stats?.totalClasses} color="border-orange-500" href="/dashboard/admin/classes" />
      </div>

      {/* Today's attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card bg-green-50 border-green-200">
          <div className="text-sm font-medium text-green-800">Today Present</div>
          <div className="text-3xl font-bold text-green-700 mt-1">{stats?.todayPresent ?? 0}</div>
        </div>
        <div className="card bg-red-50 border-red-200">
          <div className="text-sm font-medium text-red-800">Today Absent</div>
          <div className="text-3xl font-bold text-red-700 mt-1">{stats?.todayAbsent ?? 0}</div>
        </div>
        <div className="card bg-yellow-50 border-yellow-200">
          <div className="text-sm font-medium text-yellow-800">Today Late</div>
          <div className="text-3xl font-bold text-yellow-700 mt-1">{stats?.todayLate ?? 0}</div>
        </div>
      </div>

      {/* Two-column lower section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance chart */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">7-Day Attendance Trend</h3>
          <Bar data={chartData} options={{ responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true } } }} />
        </div>

        {/* Recent enrollments */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">Recent Enrollments</h3>
            <Link href="/dashboard/admin/students" className="text-sm text-primary-700 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {recentEnrollments?.map(student => (
              <div key={student.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-sm font-semibold text-primary-700">
                  {student.firstName[0]}{student.lastName[0]}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{student.firstName} {student.lastName}</div>
                  <div className="text-xs text-gray-500">Grade {student.gradeLevel}</div>
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(student.enrollmentDate).toLocaleDateString()}
                </div>
              </div>
            ))}
            {(!recentEnrollments || recentEnrollments.length === 0) && (
              <p className="text-sm text-gray-500">No recent enrollments</p>
            )}
          </div>
        </div>
      </div>

      {/* Pending invites banner */}
      {stats?.pendingInvites > 0 && (
        <div className="card bg-blue-50 border-blue-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📬</span>
            <div>
              <div className="font-medium text-blue-900">{stats.pendingInvites} pending invitation{stats.pendingInvites > 1 ? 's' : ''}</div>
              <div className="text-sm text-blue-700">Invited users haven't registered yet</div>
            </div>
          </div>
          <Link href="/dashboard/admin/settings" className="btn-primary text-sm">Manage</Link>
        </div>
      )}

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onSuccess={refetch} />}
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardLayout requiredRole="SCHOOL_ADMIN">
        <AdminDashboardContent />
      </DashboardLayout>
    </QueryClientProvider>
  );
}
