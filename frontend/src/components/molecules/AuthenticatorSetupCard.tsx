import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Input, Switch, Typography } from '@material-tailwind/react'
import { Shield } from 'lucide-react'
import { authService } from '@/api/services/auth'
import { mt } from '@/utils/mt'
import { notifyApiError, toast } from '@/features/toast'

export function AuthenticatorSetupCard({ highlight }: { highlight?: boolean }) {
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')
  const [enrollData, setEnrollData] = useState<{
    qr_code_data_url: string
    secret: string
  } | null>(null)

  const statusQuery = useQuery({
    queryKey: ['auth', 'totp', 'status'],
    queryFn: () => authService.totpStatus(),
  })

  const enrollMutation = useMutation({
    mutationFn: () => authService.totpEnroll(),
    onSuccess: (data) => {
      setEnrollData({ qr_code_data_url: data.qr_code_data_url, secret: data.secret })
      setCode('')
    },
    onError: (err) => notifyApiError(err, 'Could not start authenticator setup'),
  })

  const confirmMutation = useMutation({
    mutationFn: (totpCode: string) => authService.totpConfirm(totpCode),
    onSuccess: async () => {
      setEnrollData(null)
      setCode('')
      await queryClient.invalidateQueries({ queryKey: ['auth', 'totp', 'status'] })
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      toast.success('Authenticator app enabled.')
    },
    onError: (err) => notifyApiError(err, 'Invalid authenticator code'),
  })

  const disableMutation = useMutation({
    mutationFn: (totpCode: string) => authService.totpDisable(totpCode),
    onSuccess: async () => {
      setCode('')
      await queryClient.invalidateQueries({ queryKey: ['auth', 'totp', 'status'] })
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      toast.success('Authenticator app disabled.')
    },
    onError: (err) => notifyApiError(err, 'Could not disable authenticator'),
  })

  const enabled = statusQuery.data?.enabled ?? false

  return (
    <Card
      {...mt}
      className={`rounded-sm border p-4 ${
        highlight ? 'border-amber-300 bg-amber-50/40' : 'border-moh-green/15'
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-moh-green" />
          <Typography {...mt} className="text-sm font-bold uppercase text-moh-green">
            Authenticator app
          </Typography>
        </div>
        <div className="flex items-center gap-2 text-sm text-ui-muted">
          <span>{enabled ? 'Enabled' : 'Disabled'}</span>
          <Switch
            {...mt}
            checked={enabled}
            disabled
            className="pointer-events-none"
            color="green"
          />
        </div>
      </div>

      <p className="mb-4 text-sm text-ui-muted">
        Use Google Authenticator, Microsoft Authenticator, or a similar app to add a second step when
        signing in.
      </p>

      {!enabled && !enrollData ? (
        <Button
          {...mt}
          size="sm"
          className="rounded-sm bg-moh-green normal-case"
          onClick={() => enrollMutation.mutate()}
          disabled={enrollMutation.isPending}
        >
          {enrollMutation.isPending ? 'Preparing…' : 'Enable authenticator'}
        </Button>
      ) : null}

      {!enabled && enrollData ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <img
              src={enrollData.qr_code_data_url}
              alt="Authenticator QR code"
              className="h-44 w-44 rounded-sm border border-ui-border bg-white p-2"
            />
            <div className="text-sm text-ui-muted">
              <p className="font-medium text-ui-text">Scan this QR code</p>
              <p className="mt-1">Or enter this key manually:</p>
              <p className="mt-1 break-all font-mono text-xs text-ui-text">{enrollData.secret}</p>
            </div>
          </div>
          <Input
            {...mt}
            label="6-digit code from app"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="rounded-sm"
            color="gray"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              {...mt}
              size="sm"
              className="rounded-sm bg-moh-green normal-case"
              disabled={code.length !== 6 || confirmMutation.isPending}
              onClick={() => confirmMutation.mutate(code)}
            >
              Confirm and enable
            </Button>
            <Button
              {...mt}
              size="sm"
              variant="outlined"
              className="rounded-sm normal-case"
              onClick={() => setEnrollData(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {enabled ? (
        <div className="space-y-3">
          <p className="text-sm text-ui-text">
            Authenticator is active for your account. You will be asked for a code each time you sign
            in.
          </p>
          <Input
            {...mt}
            label="Enter code to disable"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="rounded-sm"
            color="gray"
          />
          <Button
            {...mt}
            size="sm"
            variant="outlined"
            color="red"
            className="rounded-sm normal-case"
            disabled={code.length !== 6 || disableMutation.isPending}
            onClick={() => disableMutation.mutate(code)}
          >
            Disable authenticator
          </Button>
        </div>
      ) : null}
    </Card>
  )
}
