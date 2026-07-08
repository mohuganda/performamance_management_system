import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type ReactNode } from 'react'
import { Card, Chip, Typography, Button, Alert } from '@material-tailwind/react'
import { Briefcase, Camera, Contact, PenLine, Shield, UserCircle } from 'lucide-react'
import { authService } from '@/api/services/auth'
import { leaveService } from '@/api/services/mobile'
import { PageHeader } from '@/components/organisms/PageHeader'
import { QueryState } from '@/components/organisms/QueryState'
import { UserAvatar } from '@/components/atoms/UserAvatar'
import { SignaturePad } from '@/components/molecules/SignaturePad'
import { useAuthStore } from '@/stores/appStore'
import { mt } from '@/utils/mt'

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

function formatLabel(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed || '—'
}

function ProfileField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="border-b border-gray-100 py-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{formatLabel(value)}</dd>
    </div>
  )
}

function ProfileSection({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof UserCircle
  children: ReactNode
}) {
  return (
    <Card {...mt} className="rounded-sm border border-moh-green/15 p-4">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-moh-green" />
        <Typography {...mt} className="text-sm font-bold uppercase text-moh-green">
          {title}
        </Typography>
      </div>
      {children}
    </Card>
  )
}

function ProfileFieldGrid({ children }: { children: ReactNode }) {
  return <dl className="grid gap-1 text-sm sm:grid-cols-2">{children}</dl>
}

export function ProfilePage() {
  const { displayName, email, roles, permissions, staffId, refreshProfile, hasPermission } =
    useAuthStore()
  const queryClient = useQueryClient()
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [signatureDraft, setSignatureDraft] = useState<string | null>(null)

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authService.me(),
  })

  const balancesQuery = useQuery({
    queryKey: ['profile', 'leave-balances'],
    queryFn: () => leaveService.listBalances(),
    enabled: Boolean(meQuery.data?.staff_id) && hasPermission('leave.requests.view'),
  })

  const user = meQuery.data?.user
  const staff = meQuery.data?.staff
  const account = meQuery.data?.account
  const profilePhoto = user?.ProfilePhoto ?? user?.profile_photo ?? null
  const signatureImage = signatureDraft ?? user?.SignatureImage ?? user?.signature_image ?? null
  const linkedStaffId = staffId ?? meQuery.data?.staff_id ?? staff?.staff_id

  const updateMutation = useMutation({
    mutationFn: authService.updateProfile,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      await refreshProfile()
      setStatusMessage('Profile updated successfully.')
    },
    onError: (err: Error) => {
      setStatusMessage(err.message || 'Failed to update profile.')
    },
  })

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setStatusMessage('Please select a valid image file.')
      return
    }
    if (file.size > 500_000) {
      setStatusMessage('Photo must be under 500 KB.')
      return
    }
    const dataUrl = await readFileAsDataUrl(file)
    await updateMutation.mutateAsync({ profile_photo: dataUrl })
    e.target.value = ''
  }

  const handleSignatureSave = async (dataUrl: string) => {
    await updateMutation.mutateAsync({ signature_image: dataUrl })
    setSignatureDraft(null)
  }

  const leaveBalances = Array.isArray(balancesQuery.data) ? balancesQuery.data : []

  return (
    <div>
      <PageHeader
        title="My Profile"
        subtitle="Your iHRIS staff record, account details, and approval assets"
      />

      {statusMessage ? (
        <Alert
          {...mt}
          color={updateMutation.isError ? 'red' : 'green'}
          className="mb-4 rounded-sm"
          onClose={() => setStatusMessage(null)}
        >
          {statusMessage}
        </Alert>
      ) : null}

      <QueryState
        isLoading={meQuery.isLoading}
        isError={meQuery.isError}
        error={meQuery.error}
        label="profile"
        onRetry={() => meQuery.refetch()}
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <Card {...mt} className="rounded-sm border border-moh-green/15 p-4 lg:col-span-1">
            <Typography {...mt} className="mb-4 text-sm font-bold uppercase text-moh-green">
              Profile Photo
            </Typography>
            <div className="flex flex-col items-center gap-4">
              <button
                type="button"
                className="group relative"
                onClick={() => photoInputRef.current?.click()}
                aria-label="Upload profile photo"
              >
                <UserAvatar name={staff?.name ?? user?.Name ?? displayName} photoUrl={profilePhoto} size="lg" />
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="h-8 w-8 text-white" />
                </span>
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => void handlePhotoSelect(e)}
              />
              <Button
                {...mt}
                size="sm"
                variant="outlined"
                className="rounded-sm border-moh-green/30 normal-case text-moh-green"
                onClick={() => photoInputRef.current?.click()}
                disabled={updateMutation.isPending}
              >
                {profilePhoto ? 'Change photo' : 'Upload photo'}
              </Button>
              {profilePhoto ? (
                <Button
                  {...mt}
                  size="sm"
                  variant="text"
                  className="text-xs normal-case text-gray-500"
                  onClick={() => updateMutation.mutate({ profile_photo: '' })}
                  disabled={updateMutation.isPending}
                >
                  Remove photo
                </Button>
              ) : null}
              <Typography {...mt} className="text-center text-xs text-gray-400">
                Used on approvals and your dashboard header. Max 500 KB.
              </Typography>
            </div>
          </Card>

          <Card {...mt} className="rounded-sm border border-moh-green/15 p-4 lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-moh-green" />
              <Typography {...mt} className="text-sm font-bold uppercase text-moh-green">
                Account Details
              </Typography>
            </div>
            <dl className="grid gap-1 text-sm sm:grid-cols-2">
              <ProfileField label="Full name" value={staff?.name ?? user?.Name ?? displayName} />
              <ProfileField label="Login email" value={user?.Email ?? email} />
              <ProfileField
                label="Primary role"
                value={(user?.Role ?? roles[0] ?? 'staff').replace(/_/g, ' ')}
              />
              <ProfileField
                label="Account status"
                value={account?.is_active === false ? 'Inactive' : 'Active'}
              />
              <ProfileField label="Staff ID" value={linkedStaffId ? String(linkedStaffId) : undefined} />
              <ProfileField label="iHRIS person ID" value={staff?.ihris_pid} />
              <ProfileField label="Last login" value={formatDateTime(account?.last_login_at ?? user?.LastLoginAt)} />
              <ProfileField
                label="Password last changed"
                value={formatDateTime(account?.password_changed_at ?? user?.PasswordChangedAt)}
              />
              {account?.must_change_password ? (
                <div className="border-b border-gray-100 py-2 sm:col-span-2">
                  <dt className="text-gray-500">Security</dt>
                  <dd className="font-medium text-amber-700">Password change required on next login</dd>
                </div>
              ) : null}
            </dl>
          </Card>
        </div>

        {staff ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <ProfileSection title="Employment & Placement" icon={Briefcase}>
              <ProfileFieldGrid>
                <ProfileField label="Job title" value={staff.job_title} />
                <ProfileField label="Facility" value={staff.facility_name} />
                <ProfileField label="Institution type" value={staff.institution_type} />
                <ProfileField label="Department" value={staff.department_name} />
                <ProfileField label="HR department" value={staff.hr_department_name} />
                <ProfileField label="Division" value={staff.division} />
                <ProfileField label="Section" value={staff.section} />
                <ProfileField label="Unit" value={staff.unit} />
                <ProfileField label="District" value={staff.district_name} />
                <ProfileField label="Employment terms" value={staff.employment_terms} />
                <ProfileField label="Salary grade" value={staff.salary_grade} />
                <ProfileField label="Cadre" value={staff.cadre} />
                <ProfileField label="Region" value={staff.region} />
                <ProfileField label="Supervisor" value={staff.supervisor_name} />
                <ProfileField label="iHRIS last sync" value={formatDateTime(staff.ihris_last_sync_at)} />
              </ProfileFieldGrid>
            </ProfileSection>

            <ProfileSection title="Personal & Contact" icon={Contact}>
              <ProfileFieldGrid>
                <ProfileField label="First name" value={staff.firstname} />
                <ProfileField label="Surname" value={staff.surname} />
                <ProfileField label="Other name" value={staff.othername} />
                <ProfileField label="Gender" value={staff.gender} />
                <ProfileField label="NIN" value={staff.nin} />
                <ProfileField label="Work email" value={staff.email} />
                <ProfileField label="Mobile" value={staff.mobile} />
                <ProfileField label="Telephone" value={staff.telephone} />
                <ProfileField label="Organization" value="Ministry of Health Uganda" />
              </ProfileFieldGrid>
            </ProfileSection>
          </div>
        ) : (
          <Card {...mt} className="mt-6 rounded-sm border border-amber-200 bg-amber-50/50 p-4">
            <Typography {...mt} className="text-sm text-amber-900">
              Your login is not linked to an iHRIS staff record yet. Employment and contact details
              will appear here once an administrator links your account.
            </Typography>
          </Card>
        )}

        {leaveBalances.length > 0 ? (
          <Card {...mt} className="mt-6 rounded-sm border border-moh-green/15 p-4">
            <Typography {...mt} className="mb-4 text-sm font-bold uppercase text-moh-green">
              Leave Balances ({new Date().getFullYear()})
            </Typography>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {leaveBalances.map((balance) => {
                const row = balance as {
                  id?: number
                  leave_type_name?: string
                  leave_type_code?: string
                  entitled_days?: number
                  used_days?: number
                  remaining_days?: number
                }
                const label = row.leave_type_name ?? row.leave_type_code ?? 'Leave'
                return (
                  <div
                    key={String(row.id ?? label)}
                    className="rounded-sm border border-gray-100 bg-gray-50/80 p-3"
                  >
                    <div className="text-sm font-semibold text-gray-800">{label}</div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-600">
                      <div>
                        <div className="text-gray-400">Entitled</div>
                        <div className="font-medium text-gray-800">{row.entitled_days ?? '—'}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Used</div>
                        <div className="font-medium text-gray-800">{row.used_days ?? '—'}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Remaining</div>
                        <div className="font-medium text-moh-green">{row.remaining_days ?? '—'}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        ) : null}

        <Card {...mt} className="mt-6 rounded-sm border border-moh-green/15 p-4">
          <div className="mb-4 flex items-center gap-2">
            <PenLine className="h-5 w-5 text-moh-green" />
            <Typography {...mt} className="text-sm font-bold uppercase text-moh-green">
              Electronic Signature
            </Typography>
          </div>
          <Typography {...mt} className="mb-4 text-sm text-gray-600">
            Your signature is required for leave, out-of-station, and performance approvals.
            Draw your signature in the frame below or upload a scanned image — matching the
            legacy iHRIS staff profile workflow.
          </Typography>
          <SignaturePad
            value={signatureImage}
            onChange={setSignatureDraft}
            onSave={handleSignatureSave}
            saving={updateMutation.isPending}
          />
          {user?.SignatureUpdatedAt || user?.signature_updated_at ? (
            <Typography {...mt} className="mt-3 text-xs text-gray-400">
              Last updated:{' '}
              {formatDateTime(user.SignatureUpdatedAt ?? user.signature_updated_at)}
            </Typography>
          ) : null}
        </Card>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <ProfileSection title="Roles" icon={Shield}>
            <div className="flex flex-wrap gap-2">
              {(roles.length ? roles : meQuery.data?.roles ?? []).map((role: string) => (
                <Chip
                  key={role}
                  {...mt}
                  value={role.replace(/_/g, ' ')}
                  className="rounded-sm bg-moh-green/10 text-moh-green"
                />
              ))}
            </div>
          </ProfileSection>

          <Card {...mt} className="rounded-sm border border-moh-green/15 p-4">
            <div className="mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-moh-green" />
              <Typography {...mt} className="text-sm font-bold uppercase text-moh-green">
                Permissions ({permissions.length || meQuery.data?.permissions?.length || 0})
              </Typography>
            </div>
            <div className="max-h-48 overflow-y-auto text-xs text-gray-600">
              {(permissions.length ? permissions : meQuery.data?.permissions ?? []).map(
                (perm: string) => (
                  <div key={perm} className="border-b border-gray-50 py-1">
                    {perm}
                  </div>
                ),
              )}
            </div>
          </Card>
        </div>
      </QueryState>
    </div>
  )
}
