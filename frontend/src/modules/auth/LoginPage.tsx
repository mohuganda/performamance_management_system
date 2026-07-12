import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Input, Typography } from '@material-tailwind/react'
import { BrandLogo } from '@/components/atoms/BrandLogo'
import { getApiErrorMessage } from '@/api/client'
import { authService } from '@/api/services/auth'
import { useAuthStore } from '@/stores/appStore'
import { demoAccounts, DEMO_PASSWORD } from '@/constants/demoAccounts'
import { mt } from '@/utils/mt'

type LoginMode = 'signin' | 'activate' | 'totp'

export function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const loginTotp = useAuthStore((s) => s.loginTotp)

  const [mode, setMode] = useState<LoginMode>('signin')
  const [email, setEmail] = useState('worker@moh.go.ug')
  const [password, setPassword] = useState(DEMO_PASSWORD)
  const [totpCode, setTotpCode] = useState('')
  const [loginChallenge, setLoginChallenge] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      const result = await login(email.trim(), password)
      if (result.requires_totp && result.login_challenge) {
        setLoginChallenge(result.login_challenge)
        setMode('totp')
        setTotpCode('')
        setInfo('Enter the 6-digit code from your authenticator app.')
        return
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleTotp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await loginTotp(loginChallenge, totpCode.trim())
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Invalid authenticator code'))
    } finally {
      setLoading(false)
    }
  }

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      const result = await authService.requestActivation(email.trim())
      setInfo(result.message)
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not send activation email'))
    } finally {
      setLoading(false)
    }
  }

  const pickDemo = (account: (typeof demoAccounts)[0]) => {
    setEmail(account.email)
    setPassword(account.password)
    setError(null)
    setMode('signin')
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
            {mode === 'activate'
              ? 'Activate account'
              : mode === 'totp'
                ? 'Authenticator code'
                : 'Sign in'}
          </Typography>
          <Typography {...mt} className="mb-6 mt-1 text-sm text-ui-muted">
            Ministry of Health Uganda · Performance Management System
          </Typography>

          {mode === 'signin' ? (
            <>
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

              <form className="space-y-4" onSubmit={handleSignIn}>
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

              <div className="mt-5 flex flex-col items-center gap-2 text-sm">
                <button
                  type="button"
                  className="font-medium text-moh-green hover:underline"
                  onClick={() => {
                    setMode('activate')
                    setError(null)
                    setInfo(null)
                  }}
                >
                  Activate account
                </button>
                <Typography {...mt} className="text-center text-xs text-ui-muted">
                  Demo password: <span className="font-mono text-ui-text">{DEMO_PASSWORD}</span>
                </Typography>
              </div>
            </>
          ) : null}

          {mode === 'activate' ? (
            <form className="space-y-4" onSubmit={handleActivate}>
              <p className="text-sm text-ui-muted">
                Enter the email address on your staff record. If it matches our staff database, we
                will email you a secure activation link valid for 24 hours.
              </p>
              <Input
                {...mt}
                type="email"
                label="Work email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-sm"
                color="gray"
              />
              {error ? (
                <Typography {...mt} className="text-sm text-uganda-red">
                  {error}
                </Typography>
              ) : null}
              {info ? (
                <Typography {...mt} className="text-sm text-moh-green">
                  {info}
                </Typography>
              ) : null}
              <Button
                {...mt}
                type="submit"
                fullWidth
                className="rounded-sm bg-moh-green normal-case"
                disabled={loading}
              >
                {loading ? 'Sending…' : 'Send activation link'}
              </Button>
              <button
                type="button"
                className="w-full text-center text-sm font-medium text-ui-muted hover:text-ui-text"
                onClick={() => {
                  setMode('signin')
                  setError(null)
                  setInfo(null)
                }}
              >
                Back to sign in
              </button>
            </form>
          ) : null}

          {mode === 'totp' ? (
            <form className="space-y-4" onSubmit={handleTotp}>
              {info ? <p className="text-sm text-ui-muted">{info}</p> : null}
              <Input
                {...mt}
                label="6-digit authenticator code"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
                disabled={loading || totpCode.length !== 6}
              >
                {loading ? 'Verifying…' : 'Continue'}
              </Button>
              <button
                type="button"
                className="w-full text-center text-sm font-medium text-ui-muted hover:text-ui-text"
                onClick={() => {
                  setMode('signin')
                  setLoginChallenge('')
                  setTotpCode('')
                  setError(null)
                  setInfo(null)
                }}
              >
                Back to sign in
              </button>
            </form>
          ) : null}
        </Card>
      </main>

      <footer className="border-t border-ui-border bg-ui-surface py-4 text-center text-xs text-ui-muted">
        <span className="text-ui-text">For God and My Country</span> · Saving Lives Livelihoods
        {mode === 'signin' ? null : (
          <>
            {' '}
            ·{' '}
            <Link to="/login" className="text-moh-green hover:underline">
              Sign in
            </Link>
          </>
        )}
      </footer>
    </div>
  )
}
