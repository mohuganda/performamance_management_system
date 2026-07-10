import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { SessionTimeoutGuard } from '@/components/organisms/SessionTimeoutGuard'
import { ToastViewport } from '@/components/organisms/ToastViewport'
import '@/localization/i18n'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
        <SessionTimeoutGuard />
        <ToastViewport />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
