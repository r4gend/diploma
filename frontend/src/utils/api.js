import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

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

export default api;
