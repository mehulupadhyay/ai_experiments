'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { getUser } from '@/lib/auth';

const adminNav = [
  { href: '/dashboard/admin', label: 'Dashboard', icon: '📊' },
  { href: '/dashboard/admin/students', label: 'Students', icon: '👩‍🎓' },
  { href: '/dashboard/admin/teachers', label: 'Teachers', icon: '👨‍🏫' },
  { href: '/dashboard/admin/classes', label: 'Classes & Schedule', icon: '📅' },
  { href: '/dashboard/admin/reports', label: 'Reports & Analytics', icon: '📈' },
  { href: '/dashboard/admin/settings', label: 'School Settings', icon: '⚙️' },
];

const teacherNav = [
  { href: '/dashboard/teacher', label: 'Dashboard', icon: '📊' },
  { href: '/dashboard/teacher/classes', label: 'My Classes', icon: '📚' },
  { href: '/dashboard/teacher/grades', label: 'Gradebook', icon: '✏️' },
  { href: '/dashboard/teacher/attendance', label: 'Attendance', icon: '✅' },
  { href: '/dashboard/messages', label: 'Messages', icon: '💬' },
];

const parentNav = [
  { href: '/dashboard/parent', label: 'Dashboard', icon: '🏠' },
  { href: '/dashboard/parent/children', label: 'My Children', icon: '👧' },
  { href: '/dashboard/messages', label: 'Messages', icon: '💬' },
];

const navByRole = { SCHOOL_ADMIN: adminNav, TEACHER: teacherNav, PARENT: parentNav };

export default function Sidebar({ onClose }) {
  const pathname = usePathname();
  const user = getUser();
  const nav = navByRole[user?.role] || [];
  const roleLabel = { SCHOOL_ADMIN: 'Admin Portal', TEACHER: 'Teacher Portal', PARENT: 'Parent Portal' }[user?.role] || 'Portal';

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white w-64">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-700">
        <span className="text-2xl">🎓</span>
        <div>
          <div className="font-bold text-white">EduSIS</div>
          <div className="text-xs text-gray-400">{roleLabel}</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pathname === href || (href !== '/dashboard/admin' && href !== '/dashboard/teacher' && href !== '/dashboard/parent' && pathname.startsWith(href))
                ? 'bg-primary-700 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            )}
          >
            <span className="text-lg">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      {/* User info */}
      <div className="px-4 py-4 border-t border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center text-sm font-bold">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</div>
            <div className="text-xs text-gray-400 truncate">{user?.email}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
