import axios from 'axios';

export const apiClient = axios.create({
    baseURL: `${process.env.NEXT_PUBLIC_FRONTEND_URL? process.env.NEXT_PUBLIC_FRONTEND_URL:""}/backend`,
    withCredentials: true
})

// Add request interceptor to include JWT token
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);
