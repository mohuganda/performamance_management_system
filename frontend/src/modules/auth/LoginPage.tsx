import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Input, Typography } from '@material-tailwind/react'
import { BrandLogo } from '@/components/atoms/BrandLogo'
import { getApiErrorMessage } from '@/api/client'
import { authService } from '@/api/services/auth'
import { useAuthStore } from '@/stores/appStore'
import { demoAccounts, DEMO_PASSWORD } from '@/constants/demoAccounts'
import { mt } from '@/utils/mt'

type LoginMode = 'signin' | 'activate' | 'reset' | 'totp'

export function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const loginTotp = useAuthStore((s) => s.loginTotp)

  const [mode, setMode] = useState<LoginMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [loginChallenge, setLoginChallenge] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showDemoAccounts, setShowDemoAccounts] = useState(false)

  const switchMode = (next: LoginMode) => {
    setMode(next)
    setError(null)
    setInfo(null)
  }

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

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      const result = await authService.requestPasswordReset(email.trim())
      setInfo(result.message)
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not send password reset email'))
    } finally {
      setLoading(false)
    }
  }

  const pickDemo = (account: (typeof demoAccounts)[0]) => {
    setEmail(account.email)
    setPassword(account.password)
    setError(null)
    switchMode('signin')
    setShowDemoAccounts(false)
  }

  const title =
    mode === 'activate'
      ? 'Activate account'
      : mode === 'reset'
        ? 'Reset password'
        : mode === 'totp'
          ? 'Authenticator code'
          : 'Sign in'

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
            {title}
          </Typography>
          <Typography {...mt} className="mb-6 mt-1 text-sm text-ui-muted">
            Ministry of Health Uganda · Performance Management System
          </Typography>

          {mode === 'signin' ? (
            <>
              <form className="space-y-4" onSubmit={handleSignIn}>
                <Input
                  {...mt}
                  type="email"
                  label="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
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
                  autoComplete="current-password"
                  className="rounded-sm"
                  color="gray"
                />

                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <button
                    type="button"
                    className="font-medium text-moh-green hover:underline"
                    onClick={() => switchMode('reset')}
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    className="font-medium text-moh-green hover:underline"
                    onClick={() => switchMode('activate')}
                  >
                    Activate account
                  </button>
                </div>

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

              <div className="mt-6 border-t border-ui-border pt-5">
                <button
                  type="button"
                  className="text-sm font-medium text-ui-muted hover:text-ui-text"
                  onClick={() => setShowDemoAccounts((v) => !v)}
                >
                  {showDemoAccounts ? 'Hide demo accounts' : 'Show demo accounts for testing'}
                </button>
                {showDemoAccounts ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
                    <p className="sm:col-span-2 text-center text-xs text-ui-muted">
                      Demo password: <span className="font-mono text-ui-text">{DEMO_PASSWORD}</span>
                    </p>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {mode === 'activate' ? (
            <form className="space-y-4" onSubmit={handleActivate}>
              <p className="text-sm text-ui-muted">
                First time here? Enter the email on your staff record. If it matches our database,
                we will email you a secure activation link valid for 24 hours to set your password.
              </p>
              <Input
                {...mt}
                type="email"
                label="Work email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
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
                onClick={() => switchMode('signin')}
              >
                Back to sign in
              </button>
            </form>
          ) : null}

          {mode === 'reset' ? (
            <form className="space-y-4" onSubmit={handlePasswordReset}>
              <p className="text-sm text-ui-muted">
                Enter the email address for your account. If an account exists, we will email you a
                link to set a new password within 24 hours.
              </p>
              <Input
                {...mt}
                type="email"
                label="Account email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
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
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>
              <button
                type="button"
                className="w-full text-center text-sm font-medium text-ui-muted hover:text-ui-text"
                onClick={() => switchMode('signin')}
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
                  switchMode('signin')
                  setLoginChallenge('')
                  setTotpCode('')
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
        {mode !== 'signin' ? (
          <>
            {' '}
            ·{' '}
            <Link to="/login" className="text-moh-green hover:underline" onClick={() => switchMode('signin')}>
              Sign in
            </Link>
          </>
        ) : null}
      </footer>
    </div>
  )
}
