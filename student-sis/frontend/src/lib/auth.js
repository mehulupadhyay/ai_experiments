import Cookies from 'js-cookie';

export function getUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuth(accessToken, user) {
  Cookies.set('accessToken', accessToken, { secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearAuth() {
  Cookies.remove('accessToken');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
}

export function getDashboardPath(role) {
  const paths = {
    SCHOOL_ADMIN: '/dashboard/admin',
    TEACHER: '/dashboard/teacher',
    PARENT: '/dashboard/parent',
    STUDENT: '/dashboard/student',
  };
  return paths[role] || '/dashboard';
}

export function isAuthenticated() {
  return !!Cookies.get('accessToken');
}
