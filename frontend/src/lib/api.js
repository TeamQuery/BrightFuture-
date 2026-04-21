import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  timeout: 10000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// Auth
export const login = (email, password) => api.post('/auth/login', { email, password });
export const getMe = () => api.get('/auth/me');

// Dashboard
export const getDashboard = () => api.get('/dashboard');
export const getEvents = () => api.get('/events');
export const createEvent = (data) => api.post('/events', data);
export const deleteEvent = (id) => api.delete(`/events/${id}`);

// Students
export const getStudents = (params) => api.get('/students', { params });
export const getStudent = (id) => api.get(`/students/${id}`);
export const createStudent = (data) => api.post('/students', data);
export const updateStudent = (id, data) => api.put(`/students/${id}`, data);
export const deleteStudent = (id) => api.delete(`/students/${id}`);
export const getStudentGrades = (id) => api.get(`/students/${id}/grades`);
export const getStudentAttendance = (id) => api.get(`/students/${id}/attendance`);
export const getStudentFees = (id) => api.get(`/students/${id}/fees`);

// Staff
export const getStaff = (params) => api.get('/staff', { params });
export const getStaffMember = (id) => api.get(`/staff/${id}`);
export const createStaff = (data) => api.post('/staff', data);
export const updateStaff = (id, data) => api.put(`/staff/${id}`, data);

// Academic
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
export const getGrades = (params) => api.get('/academic/grades', { params });
export const submitGrades = (data) => api.post('/academic/grades', data);

// Finance
export const getFeeCategories = () => api.get('/finance/categories');
export const createFeeCategory = (data) => api.post('/finance/categories', data);
export const getFeePayments = (params) => api.get('/finance/payments', { params });
export const createFeePayment = (data) => api.post('/finance/payments', data);
export const getFinanceSummary = (params) => api.get('/finance/summary', { params });

// Library
export const getBooks = (params) => api.get('/library/books', { params });
export const createBook = (data) => api.post('/library/books', data);
export const updateBook = (id, data) => api.put(`/library/books/${id}`, data);
export const getBorrowings = (params) => api.get('/library/borrowings', { params });
export const borrowBook = (data) => api.post('/library/borrow', data);
export const returnBook = (id) => api.put(`/library/return/${id}`);

// Parents
export const getParents = () => api.get('/parents');
export const getParent = (id) => api.get(`/parents/${id}`);
