import axios from 'axios';

export const apiClient = axios.create({
    baseURL: `${process.env.NEXT_PUBLIC_FRONTEND_URL? process.env.NEXT_PUBLIC_FRONTEND_URL:""}/backend`,
    withCredentials: true
})

// Add request interceptor to include Authorization header
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    try {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      if (decoded.type === 'login') {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        // Remove invalid token types
        localStorage.removeItem('authToken');
      }
    } catch (error) {
      // Invalid token, remove it
      localStorage.removeItem('authToken');
    }
  }
    return config;
}, (error) => {
    return Promise.reject(error);
});
