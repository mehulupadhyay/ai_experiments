import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = Cookies.get('accessToken') || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  failedQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_URL}/api/auth/refresh`, {}, { withCredentials: true });
        const { accessToken } = data;
        Cookies.set('accessToken', accessToken, { secure: true, sameSite: 'strict' });
        localStorage.setItem('accessToken', accessToken);
        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        processQueue(null, accessToken);
        return api(original);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        Cookies.remove('accessToken');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        if (typeof window !== 'undefined') window.location.href = '/auth/login';
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  register: (data) => api.post('/auth/register', data),
  validateInvite: (token) => api.get(`/auth/invite/${token}`),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
  verifyEmail: (token) => api.get(`/auth/verify-email?token=${token}`),
  me: () => api.get('/auth/me'),
  sendInvite: (data) => api.post('/auth/invite', data),
};

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  dashboard: () => api.get('/admin/dashboard'),
  getSchool: () => api.get('/admin/school'),
  updateSchool: (data) => api.patch('/admin/school', data),
  getUsers: (params) => api.get('/admin/users', { params }),
  updateUser: (id, data) => api.patch(`/admin/users/${id}`, data),
  getInvites: () => api.get('/admin/invites'),
  revokeInvite: (id) => api.delete(`/admin/invites/${id}`),
  getAcademicYears: () => api.get('/admin/academic-years'),
  createAcademicYear: (data) => api.post('/admin/academic-years', data),
  createAnnouncement: (data) => api.post('/admin/announcements', data),
  getAnnouncements: () => api.get('/admin/announcements'),
};

// ─── Students ─────────────────────────────────────────────────────────────────
export const studentsApi = {
  list: (params) => api.get('/students', { params }),
  get: (id) => api.get(`/students/${id}`),
  create: (data) => api.post('/students', data),
  update: (id, data) => api.patch(`/students/${id}`, data),
  getGrades: (id, params) => api.get(`/students/${id}/grades`, { params }),
  getAttendance: (id, params) => api.get(`/students/${id}/attendance`, { params }),
  addEmergencyContact: (id, data) => api.post(`/students/${id}/emergency-contacts`, data),
  addHealthRecord: (id, data) => api.post(`/students/${id}/health-records`, data),
};

// ─── Classes ──────────────────────────────────────────────────────────────────
export const classesApi = {
  list: (params) => api.get('/classes', { params }),
  get: (id) => api.get(`/classes/${id}`),
  create: (data) => api.post('/classes', data),
  update: (id, data) => api.patch(`/classes/${id}`, data),
  enroll: (id, studentId) => api.post(`/classes/${id}/enroll`, { studentId }),
  drop: (id, studentId) => api.delete(`/classes/${id}/enroll/${studentId}`),
  myClasses: () => api.get('/classes/teacher/mine'),
};

// ─── Attendance ───────────────────────────────────────────────────────────────
export const attendanceApi = {
  submitBulk: (data) => api.post('/attendance/bulk', data),
  getForClass: (classId, params) => api.get(`/attendance/class/${classId}`, { params }),
  getSummary: (params) => api.get('/attendance/summary', { params }),
  getAtRisk: () => api.get('/attendance/at-risk'),
};

// ─── Grades ───────────────────────────────────────────────────────────────────
export const gradesApi = {
  getForClass: (classId, params) => api.get(`/grades/class/${classId}`, { params }),
  submit: (data) => api.post('/grades', data),
  submitBulk: (data) => api.post('/grades/bulk', data),
  reportCard: (studentId, params) => api.get(`/grades/report-card/${studentId}`, { params }),
  createAssignment: (data) => api.post('/grades/assignments', data),
  getAssignments: (classId) => api.get(`/grades/assignments/${classId}`),
};

// ─── Teacher ──────────────────────────────────────────────────────────────────
export const teacherApi = {
  dashboard: () => api.get('/teacher/dashboard'),
  profile: () => api.get('/teacher/profile'),
  updateProfile: (data) => api.patch('/teacher/profile', data),
};

// ─── Parent ───────────────────────────────────────────────────────────────────
export const parentApi = {
  dashboard: () => api.get('/parent/dashboard'),
  children: () => api.get('/parent/children'),
};

// ─── Messages ─────────────────────────────────────────────────────────────────
export const messagesApi = {
  list: (params) => api.get('/messages', { params }),
  send: (data) => api.post('/messages', data),
  markRead: (id) => api.patch(`/messages/${id}/read`),
};

// ─── Google ───────────────────────────────────────────────────────────────────
export const googleApi = {
  getAuthUrl: () => api.get('/google/auth-url'),
  getCourses: () => api.get('/google/classroom/courses'),
  syncRoster: (data) => api.post('/google/classroom/sync', data),
  disconnect: () => api.delete('/google/disconnect'),
};
