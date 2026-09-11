import { Building2, Briefcase, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { authService, type StaffProfileDetail, type StaffSupervisorSlot } from '@/api/services/auth'
import { cn } from '@/utils/cn'

function formatValue(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed || '—'
}

function supervisorRoleLabel(sequence: number) {
  if (sequence === 1) return 'Primary'
  if (sequence === 2) return 'Second'
  if (sequence === 3) return 'Third'
  return `Supervisor ${sequence}`
}

type EmployeeBiodataSummaryProps = {
  staff?: StaffProfileDetail | null
  className?: string
  /** When true, show a compact link to the full profile page. */
  showProfileLink?: boolean
}

export function EmployeeBiodataSummary({
  staff,
  className,
  showProfileLink = false,
}: EmployeeBiodataSummaryProps) {
  if (!staff) {
    return (
      <section
        className={cn(
          'rounded-sm border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-950',
          className,
        )}
      >
        Your login is not linked to an iHRIS staff record yet. Job, facility, and supervisor details
        will appear here once HR links your account.
        {showProfileLink ? (
          <>
            {' '}
            <Link to="/profile" className="font-semibold text-moh-green underline-offset-2 hover:underline">
              Open profile
            </Link>
          </>
        ) : null}
      </section>
    )
  }

  const supervisors: StaffSupervisorSlot[] =
    staff.supervisors && staff.supervisors.length > 0
      ? [...staff.supervisors].sort((a, b) => a.sequence - b.sequence)
      : staff.supervisor_name
        ? [{ sequence: 1, supervisor_staff_id: 0, supervisor_name: staff.supervisor_name }]
        : []

  return (
    <section
      className={cn(
        'rounded-sm border border-moh-green/15 bg-ui-surface px-4 py-4 shadow-sm',
        className,
      )}
      aria-label="Employee biodata summary"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-moh-green">
            Biodata summary
          </p>
          <p className="text-sm font-semibold text-ui-text">{formatValue(staff.name)}</p>
        </div>
        {showProfileLink ? (
          <Link
            to="/profile"
            className="text-xs font-semibold text-moh-green underline-offset-2 hover:underline"
          >
            View full profile →
          </Link>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex gap-3 rounded-sm bg-ui-subtle/50 px-3 py-2.5">
          <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-moh-green" aria-hidden />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ui-muted">Job</p>
            <p className="text-sm font-medium text-ui-text">{formatValue(staff.job_title)}</p>
            {staff.department_name || staff.hr_department_name ? (
              <p className="mt-0.5 truncate text-xs text-ui-muted">
                {formatValue(staff.department_name || staff.hr_department_name)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex gap-3 rounded-sm bg-ui-subtle/50 px-3 py-2.5">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-moh-green" aria-hidden />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ui-muted">Facility</p>
            <p className="text-sm font-medium text-ui-text">{formatValue(staff.facility_name)}</p>
            {staff.institution_type || staff.district_name ? (
              <p className="mt-0.5 truncate text-xs text-ui-muted">
                {[staff.institution_type, staff.district_name].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex gap-3 rounded-sm bg-ui-subtle/50 px-3 py-2.5">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-moh-green" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ui-muted">
              Supervisors
            </p>
            {supervisors.length === 0 ? (
              <p className="text-sm font-medium text-amber-800">Not assigned</p>
            ) : (
              <ul className="mt-0.5 space-y-1.5">
                {supervisors.map((sup) => (
                  <li key={`${sup.sequence}-${sup.supervisor_staff_id}-${sup.supervisor_name}`}>
                    <p className="text-sm font-medium text-ui-text">
                      <span className="mr-1.5 text-[10px] font-bold uppercase tracking-wide text-moh-green">
                        {supervisorRoleLabel(sup.sequence)}
                      </span>
                      {formatValue(sup.supervisor_name)}
                    </p>
                    {sup.supervisor_job_title ? (
                      <p className="truncate text-xs text-ui-muted">{sup.supervisor_job_title}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/** Loads `/auth/me` and renders the biodata summary (for dashboards). */
export function EmployeeBiodataSummaryCard({
  className,
  showProfileLink = true,
}: {
  className?: string
  showProfileLink?: boolean
}) {
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authService.me(),
    staleTime: 60_000,
  })

  if (meQuery.isLoading) {
    return (
      <div
        className={cn(
          'h-[7.5rem] animate-pulse rounded-sm border border-ui-border bg-ui-subtle/40',
          className,
        )}
        aria-hidden
      />
    )
  }

  return (
    <EmployeeBiodataSummary
      staff={meQuery.data?.staff ?? null}
      className={className}
      showProfileLink={showProfileLink}
    />
  )
}
