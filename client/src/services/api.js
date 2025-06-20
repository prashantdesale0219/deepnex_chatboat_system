import axios from 'axios';

// Create axios instance with base URL
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized errors
    if (error.response && error.response.status === 401) {
      // Clear token and redirect to login if not already there
      if (window.location.pathname !== '/login') {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (email, password) => api.post('/auth/login', { email, password }),
  getProfile: () => api.get('/auth/me'),
  updatePassword: (currentPassword, newPassword) => 
    api.put('/auth/update-password', { currentPassword, newPassword }),
};

// Sessions API
export const sessionsAPI = {
  getAllSessions: () => api.get('/sessions'),
  getSession: (sessionId) => api.get(`/sessions/${sessionId}`),
  createSession: (configId) => api.post('/sessions', { configId }),
  deleteSession: (sessionId) => api.delete(`/sessions/${sessionId}`),
};

// Messages API
export const messagesAPI = {
  getMessages: (sessionId) => api.get(`/sessions/${sessionId}/messages`),
  sendMessage: (sessionId, message) => 
    api.post(`/sessions/${sessionId}/messages`, { message }),
};

// Configs API
export const configsAPI = {
  getAllConfigs: () => api.get('/configs'),
  getConfig: (configId) => api.get(`/configs/${configId}`),
  createConfig: (configData) => api.post('/configs', configData),
  updateConfig: (configId, configData) => api.put(`/configs/${configId}`, configData),
  deleteConfig: (configId) => api.delete(`/configs/${configId}`),
};

export default api;