import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card, Input, Typography } from '@material-tailwind/react'
import { BrandLogo } from '@/components/atoms/BrandLogo'
import { getApiErrorMessage } from '@/api/client'
import { authService } from '@/api/services/auth'
import { useAuthStore } from '@/stores/appStore'
import { mt } from '@/utils/mt'

export function ActivateAccountPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const applyActivationLogin = useAuthStore((s) => s.applyActivationLogin)

  const token = searchParams.get('token') ?? ''

  const [loading, setLoading] = useState(true)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [staffName, setStaffName] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setPreviewError('Activation link is missing or invalid.')
      setLoading(false)
      return
    }
    authService
      .previewActivation(token)
      .then((preview) => {
        setStaffName(preview.staff_name)
        setEmail(preview.email)
        setName(preview.staff_name)
        setPreviewError(null)
      })
      .catch((err: unknown) => {
        setPreviewError(getApiErrorMessage(err, 'Activation link is invalid or expired'))
      })
      .finally(() => setLoading(false))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    if (password.length < 10) {
      setSubmitError('Password must be at least 10 characters.')
      return
    }
    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      const result = await authService.completeActivation({
        token,
        password,
        name: name.trim() || undefined,
      })
      await applyActivationLogin(result)
      navigate('/profile?setup=1', { replace: true })
    } catch (err: unknown) {
      setSubmitError(getApiErrorMessage(err, 'Could not activate account'))
    } finally {
      setSubmitting(false)
    }
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
            Activate your account
          </Typography>
          <Typography {...mt} className="mb-6 mt-1 text-sm text-ui-muted">
            Set your password to access MoH Performance Management System.
          </Typography>

          {loading ? (
            <p className="text-sm text-ui-muted">Validating activation link…</p>
          ) : previewError ? (
            <div className="space-y-4">
              <Typography {...mt} className="text-sm text-uganda-red">
                {previewError}
              </Typography>
              <Button
                {...mt}
                variant="outlined"
                className="rounded-sm normal-case"
                onClick={() => navigate('/login')}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <p className="rounded-sm border border-moh-green/20 bg-moh-green/5 px-3 py-2 text-sm text-ui-text">
                Activating account for <strong>{staffName}</strong>
                {email ? (
                  <>
                    {' '}
                    (<span className="font-mono text-xs">{email}</span>)
                  </>
                ) : null}
              </p>
              <Input
                {...mt}
                label="Display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-sm"
                color="gray"
              />
              <Input
                {...mt}
                type="password"
                label="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-sm"
                color="gray"
              />
              <Input
                {...mt}
                type="password"
                label="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="rounded-sm"
                color="gray"
              />
              {submitError ? (
                <Typography {...mt} className="text-sm text-uganda-red">
                  {submitError}
                </Typography>
              ) : null}
              <Button
                {...mt}
                type="submit"
                fullWidth
                className="rounded-sm bg-uganda-black normal-case hover:bg-ui-text"
                disabled={submitting}
              >
                {submitting ? 'Activating…' : 'Activate and continue'}
              </Button>
              <p className="text-center text-xs text-ui-muted">
                After activation you can update your profile and optionally enable an authenticator
                app for extra security.
              </p>
            </form>
          )}
        </Card>
      </main>
    </div>
  )
}
