import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
});

const authApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
});

let accessToken = null;
let refreshPromise = null;
let unauthorizedHandler = null;

function isAuthRoute(url = '') {
  return ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'].some((route) =>
    url.includes(route),
  );
}

function buildAuthorizationHeader() {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export function setAccessToken(token) {
  accessToken = token || null;
}

export function clearAccessToken() {
  accessToken = null;
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export function extractApiError(error, fallbackMessage = 'Request failed') {
  const data = error?.response?.data;

  if (data?.errors && typeof data.errors === 'object') {
    const fieldMessages = Object.values(data.errors).flat().filter(Boolean);
    if (fieldMessages.length) {
      return fieldMessages[0];
    }
  }

  if (data?.detail) {
    return data.detail;
  }

  if (data?.title) {
    return data.title;
  }

  if (data?.error) {
    return data.error;
  }

  if (data?.message) {
    return data.message;
  }

  return error?.message || fallbackMessage;
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = authApi
      .post('/auth/refresh')
      .then((response) => {
        setAccessToken(response.data.accessToken || response.data.token);
        return response.data;
      })
      .catch((error) => {
        clearAccessToken();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function bootstrapSession() {
  return refreshAccessToken();
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${accessToken}`,
    };
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!error.response || !originalRequest) {
      return Promise.reject(error);
    }

    const shouldAttemptRefresh =
      error.response.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.skipAuthRefresh &&
      !isAuthRoute(originalRequest.url);

    if (shouldAttemptRefresh) {
      originalRequest._retry = true;

      try {
        await refreshAccessToken();

        originalRequest.headers = {
          ...originalRequest.headers,
          ...buildAuthorizationHeader(),
        };

        return api(originalRequest);
      } catch (refreshError) {
        unauthorizedHandler?.();
        return Promise.reject(refreshError);
      }
    }

    if (error.response.status === 401 && originalRequest.url?.includes('/auth/refresh')) {
      clearAccessToken();
      unauthorizedHandler?.();
    }

    return Promise.reject(error);
  },
);

export default api;

// Auth
export async function login(email, password) {
  const response = await authApi.post('/auth/login', { email, password });
  setAccessToken(response.data.accessToken || response.data.token);
  return response;
}

export async function register(name, email, password) {
  const response = await authApi.post('/auth/register', { name, email, password });
  setAccessToken(response.data.accessToken || response.data.token);
  return response;
}

export async function logout() {
  try {
    await authApi.post(
      '/auth/logout',
      {},
      {
        headers: buildAuthorizationHeader(),
        skipAuthRefresh: true,
      },
    );
  } finally {
    clearAccessToken();
  }
}

export const getMe = () => api.get('/auth/me');

// Health
export const getSystemHealth = () => axios.get(`${API_ORIGIN}/health/ready`, { timeout: 10000 });

// Users / Admin
export const getUsers = (params) => api.get('/users', { params });
export const getAuditLogs = (params) => api.get('/users/audit-logs', { params });
export const softDeleteUser = (id) => api.delete(`/users/${id}`);

// Legacy school-domain endpoints retained for future backend expansion.
export const getDashboard = () => api.get('/dashboard');
export const getEvents = () => api.get('/events');
export const createEvent = (data) => api.post('/events', data);
export const deleteEvent = (id) => api.delete(`/events/${id}`);
export const getStudents = (params) => api.get('/students', { params });
export const getStudent = (id) => api.get(`/students/${id}`);
export const createStudent = (data) => api.post('/students', data);
export const updateStudent = (id, data) => api.put(`/students/${id}`, data);
export const deleteStudent = (id) => api.delete(`/students/${id}`);
export const getStudentGrades = (id) => api.get(`/students/${id}/grades`);
export const getStudentAttendance = (id) => api.get(`/students/${id}/attendance`);
export const getStudentFees = (id) => api.get(`/students/${id}/fees`);
export const getStaff = (params) => api.get('/staff', { params });
export const getStaffMember = (id) => api.get(`/staff/${id}`);
export const createStaff = (data) => api.post('/staff', data);
export const updateStaff = (id, data) => api.put(`/staff/${id}`, data);
export const getClasses = () => api.get('/academic/classes');
export const createClass = (data) => api.post('/academic/classes', data);
export const getSubjects = () => api.get('/academic/subjects');
export const createSubject = (data) => api.post('/academic/subjects', data);
export const getTimetable = (params) => api.get('/academic/timetable', { params });
export const createTimetable = (data) => api.post('/academic/timetable', data);
export const getAttendance = (params) => api.get('/academic/attendance', { params });
export const markAttendance = (data) => api.post('/academic/attendance', data);
export const getAttendanceSummary = (params) => api.get('/academic/attendance/summary', { params });
export const getExams = (params) => api.get('/academic/exams', { params });
export const createExam = (data) => api.post('/academic/exams', data);
export const getGrades = (params) => api.get('/grades', { params });
export const submitGrades = (data) => api.post('/academic/grades', data);
export const getFeeCategories = () => api.get('/finance/categories');
export const createFeeCategory = (data) => api.post('/finance/categories', data);
export const getFeePayments = (params) => api.get('/finance/payments', { params });
export const createFeePayment = (data) => api.post('/finance/payments', data);
export const getFinanceSummary = (params) => api.get('/finance/summary', { params });
export const getBooks = (params) => api.get('/library/books', { params });
export const createBook = (data) => api.post('/library/books', data);
export const updateBook = (id, data) => api.put(`/library/books/${id}`, data);
export const getBorrowings = (params) => api.get('/library/borrowings', { params });
export const borrowBook = (data) => api.post('/library/borrow', data);
export const returnBook = (id) => api.put(`/library/return/${id}`);
export const getParents = () => api.get('/parents');
export const getParent = (id) => api.get(`/parents/${id}`);

// Dashboard functions
export const getMyGrades = () => api.get('/grades');
export const getMyAttendance = () => api.get('/academic/attendance');
export const getTeacherClasses = () => api.get('/academic/classes');
export const getTeacherAttendanceSummary = () => api.get('/academic/attendance/summary');
export const getLibraryStats = () => api.get('/library/stats');
export const getFinanceStats = () => api.get('/finance/summary');
