import apiClient from '../client'

export type DocumentType =
  | 'ppa'
  | 'quarterly_report'
  | 'appraisal'
  | 'leave_request'
  | 'oos_request'

export type DocumentEnsureResult = {
  token: string
  verify_url: string
  qr_code_data_url: string
  document_type: string
  title: string
  period_label: string
  staff_name: string
  status: string
}

export type DocumentPublicVerify = {
  valid: boolean
  message: string
  organisation_name?: string
  document_type?: string
  document_label?: string
  title?: string
  period_label?: string
  staff_name?: string
  status?: string
  issued_at?: string
}

export type LetterheadSettings = {
  org_name: string
  org_title_line: string
  tagline: string
  address_line: string
  postal_address: string
  phone: string
  toll_free: string
  email: string
  website: string
  footer_note: string
}

export const DEFAULT_LETTERHEAD: LetterheadSettings = {
  org_name: 'Ministry of Health',
  org_title_line: 'MINISTRY OF HEALTH',
  tagline: 'Republic of Uganda · Performance Management System',
  address_line: 'Plot 6, Lourdel Road, Nakasero, Kampala',
  postal_address: 'P.O. Box 7272, Kampala, Uganda',
  phone: '+256 417 712260',
  toll_free: '0800-100-066',
  email: 'info@health.go.ug',
  website: 'https://www.health.go.ug',
  footer_note: 'Scan the QR code to verify this document on the MoH PMS.',
}

export const documentsService = {
  ensureVerification: async (documentType: DocumentType, refId: number) => {
    const { data } = await apiClient.post<DocumentEnsureResult>('/documents/verification', {
      document_type: documentType,
      ref_id: refId,
    })
    return data
  },
  verifyPublic: async (token: string) => {
    const { data } = await apiClient.get<DocumentPublicVerify>(`/verify/documents/${token}`)
    return data
  },
}
