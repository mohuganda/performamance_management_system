import axios from 'axios'
import { useAuthStore } from '@/stores/appStore'
import { redirectToLogin } from '@/utils/authRedirect'

declare module 'axios' {
  interface AxiosRequestConfig {
    /** When true, a 401 response will not trigger session clear / login redirect. */
    skipAuthHandler?: boolean
  }
}

let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
}

const defaultBaseURL =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? '/api/v1' : 'http://127.0.0.1:3030/api/v1')

const apiClient = axios.create({
  baseURL: defaultBaseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

export function getApiErrorMessage(err: unknown, fallback = 'Request failed'): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return 'Cannot reach the API server. Start the backend: cd backend && go run .'
    }
    const message = err.response.data?.message
    if (typeof message === 'string' && message.trim()) {
      return message
    }
  }
  if (err instanceof Error && err.message) {
    return err.message
  }
  return fallback
}

apiClient.interceptors.request.use((config) => {
  const token = authToken ?? useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config
    if (error.response?.status === 401 && !config?.skipAuthHandler) {
      const { isAuthenticated, clearSession } = useAuthStore.getState()
      if (isAuthenticated) {
        clearSession()
        redirectToLogin()
      }
    }
    return Promise.reject(error)
  },
)

export default apiClient
