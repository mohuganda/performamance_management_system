import { useState } from 'react'
import { Button, Card, Input, Typography } from '@material-tailwind/react'
import { BrandLogo } from '@/components/atoms/BrandLogo'
import { useAuthStore } from '@/stores/appStore'
import { demoAccounts, DEMO_PASSWORD } from '@/constants/demoAccounts'
import { mt } from '@/utils/mt'

export function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState('worker@moh.go.ug')
  const [password, setPassword] = useState(DEMO_PASSWORD)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email.trim(), password)
    } catch (err: unknown) {
      const axiosMsg =
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message ===
          'string'
          ? (err as { response: { data: { message: string } } }).response.data.message
          : null
      setError(axiosMsg ?? (err instanceof Error ? err.message : 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  const pickDemo = (account: (typeof demoAccounts)[0]) => {
    setEmail(account.email)
    setPassword(account.password)
    setError(null)
  }

  return (
    <div className="flex min-h-screen flex-col bg-ui-bg">
      <header className="border-b border-ui-border bg-ui-surface px-6 py-4">
        <div className="mx-auto flex max-w-4xl justify-center">
          <BrandLogo size="lg" />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <Card
          {...mt}
          className="w-full max-w-lg rounded-sm border border-ui-border bg-ui-surface p-8 shadow-sm"
        >
          <Typography {...mt} variant="h5" className="font-semibold text-ui-text">
            Sign in
          </Typography>
          <Typography {...mt} className="mb-6 mt-1 text-sm text-ui-muted">
            Ministry of Health Uganda · Performance Management System
          </Typography>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ui-muted">
            Demo accounts
          </p>
          <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {demoAccounts.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => pickDemo(account)}
                className={`rounded-sm border p-3 text-left transition ${
                  email === account.email
                    ? 'border-uganda-black bg-ui-subtle ring-1 ring-uganda-black/20'
                    : 'border-ui-border bg-white hover:border-ui-muted'
                }`}
              >
                <p className="text-sm font-semibold text-ui-text">{account.label}</p>
                <p className="text-xs text-ui-muted">{account.description}</p>
                <p className="mt-1 font-mono text-[10px] text-ui-muted">{account.email}</p>
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              {...mt}
              type="email"
              label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-sm"
              color="gray"
            />
            <Input
              {...mt}
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="rounded-sm"
              color="gray"
            />
            {error ? (
              <Typography {...mt} className="text-sm text-uganda-red">
                {error}
              </Typography>
            ) : null}
            <Button
              {...mt}
              type="submit"
              fullWidth
              className="rounded-sm bg-uganda-black normal-case hover:bg-ui-text"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <Typography {...mt} className="mt-5 text-center text-xs text-ui-muted">
            Demo password: <span className="font-mono text-ui-text">{DEMO_PASSWORD}</span>
          </Typography>
        </Card>
      </main>

      <footer className="border-t border-ui-border bg-ui-surface py-4 text-center text-xs text-ui-muted">
        <span className="text-ui-text">For God and My Country</span> · Saving Lives Livelihoods
      </footer>
    </div>
  )
}
