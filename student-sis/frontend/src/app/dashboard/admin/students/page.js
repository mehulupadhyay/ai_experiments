'use client';
import { useState } from 'react';
import { useQuery } from 'react-query';
import { QueryClient, QueryClientProvider } from 'react-query';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { studentsApi, authApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import Link from 'next/link';

const queryClient = new QueryClient();

function AddStudentModal({ onClose, onSuccess }) {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await studentsApi.create(data);
      toast.success('Student added successfully');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add student');
    } finally {
      setLoading(false);
    }
  };

  const grades = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-6 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-5">Add New Student</h3>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input className="input" {...register('firstName', { required: true })} />
              {errors.firstName && <p className="text-xs text-red-600 mt-1">Required</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input className="input" {...register('lastName', { required: true })} />
              {errors.lastName && <p className="text-xs text-red-600 mt-1">Required</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level *</label>
              <select className="input" {...register('gradeLevel', { required: true })}>
                <option value="">Select grade</option>
                {grades.map(g => <option key={g} value={g}>{g === 'K' ? 'Kindergarten' : `Grade ${g}`}</option>)}
              </select>
              {errors.gradeLevel && <p className="text-xs text-red-600 mt-1">Required</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student Number</label>
              <input className="input" placeholder="Auto-generated" {...register('studentNumber')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <input type="date" className="input" {...register('dateOfBirth')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select className="input" {...register('gender')}>
                <option value="">Prefer not to say</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input className="input" {...register('address')} placeholder="Street address" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <input className="input" placeholder="City" {...register('city')} />
            </div>
            <div>
              <input className="input" placeholder="State" {...register('state')} />
            </div>
            <div>
              <input className="input" placeholder="ZIP" {...register('zipCode')} />
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('iep')} /> IEP</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('ell')} /> ELL</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('gifted')} /> Gifted</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? 'Saving...' : 'Add Student'}</button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StudentsContent() {
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading, refetch } = useQuery(
    ['students', search, gradeFilter, page],
    () => studentsApi.list({ search, gradeLevel: gradeFilter, page, limit: 20 }).then(r => r.data),
    { keepPreviousData: true }
  );

  const grades = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Students</h1>
        <button onClick={() => setShowAdd(true)} className="btn-primary">+ Add Student</button>
      </div>

      {/* Filters */}
      <div className="card flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          placeholder="Search by name or student number..."
          className="input flex-1"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <select className="input sm:w-48" value={gradeFilter} onChange={e => { setGradeFilter(e.target.value); setPage(1); }}>
          <option value="">All Grades</option>
          {grades.map(g => <option key={g} value={g}>{g === 'K' ? 'Kindergarten' : `Grade ${g}`}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Student</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">ID</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Grade</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Flags</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">Loading...</td></tr>
              ) : data?.students?.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">No students found</td></tr>
              ) : (
                data?.students?.map(student => (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-sm font-semibold text-primary-700 flex-shrink-0">
                          {student.firstName[0]}{student.lastName[0]}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{student.firstName} {student.lastName}</div>
                          {student.preferredName && <div className="text-xs text-gray-500">({student.preferredName})</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">{student.studentNumber}</td>
                    <td className="px-6 py-4"><span className="badge bg-blue-100 text-blue-800">{student.gradeLevel === 'K' ? 'KG' : `Gr. ${student.gradeLevel}`}</span></td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        {student.iep && <span className="badge bg-purple-100 text-purple-700">IEP</span>}
                        {student.ell && <span className="badge bg-orange-100 text-orange-700">ELL</span>}
                        {student.gifted && <span className="badge bg-yellow-100 text-yellow-700">GT</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/dashboard/admin/students/${student.id}`} className="text-sm text-primary-700 hover:underline font-medium">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
            <span>{data.total} students</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1 px-3 disabled:opacity-40">Prev</button>
              <span className="py-1 px-2">Page {page} of {data.pages}</span>
              <button disabled={page === data.pages} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1 px-3 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {showAdd && <AddStudentModal onClose={() => setShowAdd(false)} onSuccess={refetch} />}
    </div>
  );
}

export default function StudentsPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardLayout requiredRole="SCHOOL_ADMIN">
        <StudentsContent />
      </DashboardLayout>
    </QueryClientProvider>
  );
}
