import axios from 'axios';
import Config from 'react-native-config';
import { useAuthStore } from '../stores/authStore';

declare module 'axios' {
  interface AxiosRequestConfig {
    skipAuthHandler?: boolean;
  }
}

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

let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (error: any) => void }[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.skipAuthHandler
    ) {
      const { isAuthenticated, logout, token: currentToken } = useAuthStore.getState();

      if (!isAuthenticated || !currentToken) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post<{ token: string; token_type: string }>(
          `${apiClient.defaults.baseURL}/auth/refresh`,
          {},
          {
            headers: {
              Authorization: `Bearer ${authToken || currentToken}`,
            },
          }
        );

        const newToken = data.token;
        setAuthToken(newToken);
        
        // Update Zustand store token state
        useAuthStore.setState({ token: newToken });

        processQueue(null, newToken);
        isRefreshing = false;

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;

        setAuthToken(null);
        await logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

export function getApiErrorMessage(error: unknown, fallbackMessage = 'An unexpected error occurred'): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.message || fallbackMessage;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallbackMessage;
}
