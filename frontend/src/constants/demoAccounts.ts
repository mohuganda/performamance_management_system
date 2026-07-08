export interface DemoAccount {
  email: string
  password: string
  role: string
  label: string
  description: string
}

export const DEMO_PASSWORD = 'Demo@Moh2026!'

export const demoAccounts: DemoAccount[] = [
  {
    email: 'worker@moh.go.ug',
    password: DEMO_PASSWORD,
    role: 'Health Worker',
    label: 'Health Worker',
    description: 'Leave, attendance, PPA & personal dashboard',
  },
  {
    email: 'supervisor@moh.go.ug',
    password: DEMO_PASSWORD,
    role: 'Supervisor',
    label: 'Supervisor',
    description: 'Team approvals, leave & performance oversight',
  },
  {
    email: 'depthead@moh.go.ug',
    password: DEMO_PASSWORD,
    role: 'Department Head',
    label: 'Department Head',
    description: 'Department dashboards & escalated approvals',
  },
  {
    email: 'hr@moh.go.ug',
    password: DEMO_PASSWORD,
    role: 'HR Officer',
    label: 'HR Officer',
    description: 'HR dashboard, staff records & KPI management',
  },
  {
    email: 'director@moh.go.ug',
    password: DEMO_PASSWORD,
    role: 'Director',
    label: 'Director',
    description: 'Executive dashboard & district-wide approvals',
  },
  {
    email: 'ps@moh.go.ug',
    password: DEMO_PASSWORD,
    role: 'Permanent Secretary',
    label: 'Permanent Secretary',
    description: 'Top executive decision-maker — org-wide visibility',
  },
  {
    email: 'admin@moh.go.ug',
    password: DEMO_PASSWORD,
    role: 'Administrator',
    label: 'Administrator',
    description: 'Full system access, settings & access control',
  },
]
