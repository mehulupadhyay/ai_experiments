'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { classesApi, attendanceApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const queryClient = new QueryClient();

const STATUS_OPTIONS = [
  { value: 'PRESENT', label: 'Present', color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'ABSENT', label: 'Absent', color: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'LATE', label: 'Late', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { value: 'EXCUSED', label: 'Excused', color: 'bg-blue-100 text-blue-700 border-blue-300' },
];

function AttendanceContent() {
  const searchParams = useSearchParams();
  const initialClassId = searchParams.get('classId') || '';
  const [selectedClassId, setSelectedClassId] = useState(initialClassId);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [records, setRecords] = useState({});
  const qc = useQueryClient();

  const { data: classes } = useQuery('my-classes', () => classesApi.myClasses().then(r => r.data));
  const { data: classDetail } = useQuery(
    ['class-detail', selectedClassId],
    () => classesApi.get(selectedClassId).then(r => r.data),
    { enabled: !!selectedClassId }
  );
  const { data: existingAttendance } = useQuery(
    ['attendance', selectedClassId, date],
    () => attendanceApi.getForClass(selectedClassId, { date }).then(r => r.data),
    { enabled: !!selectedClassId && !!date }
  );

  // Pre-fill from existing records
  useEffect(() => {
    if (existingAttendance && classDetail) {
      const map = {};
      existingAttendance.forEach(r => { map[r.studentId] = { status: r.status, notes: r.notes || '' }; });
      // Default unrecorded to PRESENT
      classDetail.enrollments?.forEach(e => {
        if (!map[e.studentId]) map[e.studentId] = { status: 'PRESENT', notes: '' };
      });
      setRecords(map);
    }
  }, [existingAttendance, classDetail]);

  const submitMutation = useMutation(
    () => attendanceApi.submitBulk({
      classId: selectedClassId,
      date,
      records: Object.entries(records).map(([studentId, r]) => ({ studentId, ...r })),
    }),
    {
      onSuccess: () => {
        toast.success('Attendance saved! Parents will be notified of absences.');
        qc.invalidateQueries(['attendance', selectedClassId, date]);
      },
      onError: (err) => toast.error(err.response?.data?.error || 'Failed to save attendance'),
    }
  );

  const markAll = (status) => {
    const updated = {};
    classDetail?.enrollments?.forEach(e => { updated[e.studentId] = { status, notes: records[e.studentId]?.notes || '' }; });
    setRecords(updated);
  };

  const students = classDetail?.enrollments?.map(e => e.student) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Take Attendance</h1>
        <p className="text-gray-500 text-sm mt-1">Mark attendance for your class</p>
      </div>

      {/* Controls */}
      <div className="card flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-40">
          <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
          <select className="input" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
            <option value="">Select a class</option>
            {classes?.map(c => <option key={c.id} value={c.id}>{c.name} ({c.subject})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} max={format(new Date(), 'yyyy-MM-dd')} />
        </div>
        {selectedClassId && students.length > 0 && (
          <div className="flex gap-2">
            <button onClick={() => markAll('PRESENT')} className="btn-secondary text-sm py-2 px-3">All Present</button>
            <button onClick={() => markAll('ABSENT')} className="btn-secondary text-sm py-2 px-3">All Absent</button>
          </div>
        )}
      </div>

      {selectedClassId && students.length > 0 && (
        <>
          <div className="card p-0 overflow-hidden">
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">{students.length} students enrolled</span>
              <span className="text-sm text-gray-500">{format(new Date(date), 'MMMM d, yyyy')}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {students.map((student, i) => {
                const record = records[student.id] || { status: 'PRESENT', notes: '' };
                return (
                  <div key={student.id} className="px-6 py-3 flex items-center gap-4">
                    <div className="w-8 text-sm text-gray-400 text-right flex-shrink-0">{i + 1}</div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{student.lastName}, {student.firstName}</div>
                      <div className="text-xs text-gray-400 font-mono">{student.studentNumber}</div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {STATUS_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setRecords(prev => ({ ...prev, [student.id]: { ...record, status: opt.value } }))}
                          className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${record.status === opt.value ? opt.color + ' ring-2 ring-offset-1 ring-current' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isLoading}
              className="btn-primary px-8 py-2.5"
            >
              {submitMutation.isLoading ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        </>
      )}

      {selectedClassId && students.length === 0 && (
        <div className="card text-center py-12 text-gray-500">No students enrolled in this class</div>
      )}
    </div>
  );
}

export default function AttendancePage() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardLayout requiredRole="TEACHER">
        <AttendanceContent />
      </DashboardLayout>
    </QueryClientProvider>
  );
}
