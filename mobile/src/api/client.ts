import axios from 'axios';
import Config from 'react-native-config';
import { useAuthStore } from '../stores/authStore';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

const apiClient = axios.create({
  baseURL: Config.API_BASE_URL || 'http://localhost:3030/api/v1',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = authToken || useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const { isAuthenticated, logout } = useAuthStore.getState();
      if (isAuthenticated) {
        setAuthToken(null);
        await logout();
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;

