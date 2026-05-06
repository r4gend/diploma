import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401 (only if not already on auth pages)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const path = window.location.pathname;
      if (!path.startsWith('/login') && !path.startsWith('/register')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// --- Auth ---
export const loginUser = (data) => api.post('/auth/login', data).then(r => r.data);
export const registerUser = (data) => api.post('/auth/register', data).then(r => r.data);
export const fetchMe = () => api.get('/auth/me').then(r => r.data);

// --- Tests ---
export const fetchSummary = () => api.get('/tests/summary').then(r => r.data);

export const fetchTests = (params = {}) =>
  api.get('/tests/', { params }).then(r => r.data);

export const fetchTest = (id) => api.get(`/tests/${id}`).then(r => r.data);

export const createTest = (data) => api.post('/tests/', data).then(r => r.data);

export const updateTest = (id, data) =>
  api.put(`/tests/${id}`, data).then(r => r.data);

export const deleteTest = (id) => api.delete(`/tests/${id}`);

// --- Execution ---
export const runTest = (id) => api.post(`/tests/${id}/run`).then(r => r.data);

export const cancelTest = (id) =>
  api.post(`/tests/${id}/cancel`).then(r => r.data);

// --- Results ---
export const fetchResults = (id, params = {}) =>
  api.get(`/tests/${id}/results`, { params }).then(r => r.data);

export const fetchTimeline = (id) =>
  api.get(`/tests/${id}/timeline`).then(r => r.data);

export const fetchProgress = (id) =>
  api.get(`/tests/${id}/progress`).then(r => r.data);

export default api;
