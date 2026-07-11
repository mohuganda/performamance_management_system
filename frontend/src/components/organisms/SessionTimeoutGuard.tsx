import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Card, Typography } from '@material-tailwind/react'
import { Clock } from 'lucide-react'
import {
  SESSION_EXPIRY_CHECK_MS,
  SESSION_IDLE_MS,
  SESSION_TOKEN_WARN_BEFORE_MS,
  SESSION_WARNING_MS,
} from '@/constants/session'
import { useAuthStore } from '@/stores/appStore'
import { redirectToLogin } from '@/utils/authRedirect'
import { getTokenExpiryMs } from '@/utils/jwt'
import { mt } from '@/utils/mt'

type WarningReason = 'idle' | 'expiry'

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'] as const

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000))
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

export function SessionTimeoutGuard() {
  const { isAuthenticated, token, clearSession, refreshSession } = useAuthStore()

  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<WarningReason>('idle')
  const [deadline, setDeadline] = useState<number | null>(null)
  const [remainingMs, setRemainingMs] = useState(SESSION_WARNING_MS)
  const [busy, setBusy] = useState(false)

  const lastActivityRef = useRef(Date.now())
  const openRef = useRef(false)
  const signingOutRef = useRef(false)
  const idleTimerRef = useRef<number | null>(null)

  const clearIdleTimer = () => {
    if (idleTimerRef.current != null) {
      window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }

  const scheduleIdleTimer = useCallback(() => {
    clearIdleTimer()
    if (!isAuthenticated) return
    idleTimerRef.current = window.setTimeout(() => {
      if (!openRef.current) {
        setReason('idle')
        setOpen(true)
        setDeadline(Date.now() + SESSION_WARNING_MS)
      }
    }, SESSION_IDLE_MS)
  }, [isAuthenticated])

  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    if (!openRef.current) {
      scheduleIdleTimer()
    }
  }, [scheduleIdleTimer])

  const showWarning = useCallback((nextReason: WarningReason) => {
    if (openRef.current) return
    setReason(nextReason)
    setOpen(true)
    setDeadline(Date.now() + SESSION_WARNING_MS)
  }, [])

  const endSession = useCallback(() => {
    clearSession()
    redirectToLogin()
  }, [clearSession])

  const handleStaySignedIn = async () => {
    setBusy(true)
    try {
      await refreshSession()
      openRef.current = false
      setOpen(false)
      setDeadline(null)
      lastActivityRef.current = Date.now()
      scheduleIdleTimer()
    } catch {
      endSession()
    } finally {
      setBusy(false)
    }
  }

  const handleSignOut = () => {
    if (signingOutRef.current) return
    signingOutRef.current = true
    setBusy(true)
    endSession()
  }

  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    if (!isAuthenticated) {
      clearIdleTimer()
      setOpen(false)
      setDeadline(null)
      return
    }

    lastActivityRef.current = Date.now()
    scheduleIdleTimer()

    let throttleTimer: number | null = null
    const onActivity = () => {
      if (throttleTimer != null) return
      throttleTimer = window.setTimeout(() => {
        throttleTimer = null
        recordActivity()
      }, 1000)
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true })
    }

    const expiryInterval = window.setInterval(() => {
      if (openRef.current) return
      const expiresAt = getTokenExpiryMs(token)
      if (expiresAt != null && expiresAt - Date.now() <= SESSION_TOKEN_WARN_BEFORE_MS) {
        showWarning('expiry')
      }
    }, SESSION_EXPIRY_CHECK_MS)

    return () => {
      clearIdleTimer()
      if (throttleTimer != null) window.clearTimeout(throttleTimer)
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity)
      }
      window.clearInterval(expiryInterval)
    }
  }, [isAuthenticated, token, recordActivity, scheduleIdleTimer, showWarning])

  useEffect(() => {
    if (!open || deadline == null) return

    const tick = () => {
      const left = deadline - Date.now()
      setRemainingMs(left)
      if (left <= 0) {
        window.clearInterval(interval)
        handleSignOut()
      }
    }

    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deadline])

  if (!isAuthenticated || !open) {
    return null
  }

  const title = reason === 'idle' ? 'Still there?' : 'Session expiring soon'
  const message =
    reason === 'idle'
      ? 'You have been inactive for a while. Your session will end soon unless you choose to stay signed in.'
      : 'Your login session is about to expire. Stay signed in to continue working without interruption.'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
    >
      <Card
        {...mt}
        className="w-full max-w-md rounded-sm border border-moh-green/20 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="rounded-sm bg-amber-100 p-2 text-amber-700">
            <Clock className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <Typography {...mt} className="text-lg font-bold text-ui-text">
              {title}
            </Typography>
            <p className="mt-2 text-sm leading-relaxed text-ui-muted">{message}</p>
            <p className="mt-3 text-sm font-medium text-ui-text">
              Signing out automatically in{' '}
              <span className="font-semibold text-moh-green">{formatCountdown(remainingMs)}</span>
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            {...mt}
            variant="outlined"
            className="rounded-sm normal-case"
            disabled={busy}
            onClick={handleSignOut}
          >
            Sign out
          </Button>
          <Button
            {...mt}
            className="rounded-sm bg-moh-green normal-case"
            disabled={busy}
            onClick={() => void handleStaySignedIn()}
          >
            {busy ? 'Please wait…' : 'Stay signed in'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
