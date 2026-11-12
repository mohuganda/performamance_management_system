import { useState, useMemo, useEffect, type FormEvent } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { parseISO, startOfDay } from 'date-fns'
import { DatePickerField } from '@/components/molecules/DatePickerField'
import { FileAttachmentField } from '@/components/molecules/FileAttachmentField'
import { FormStatusAlert, type FormStatusType } from '@/components/molecules/FormStatusAlert'
import { OosLocationPickerMap } from '@/components/molecules/OosLocationPickerMap'
import { PlaceAutocompleteField, type PlaceSelection } from '@/components/molecules/PlaceAutocompleteField'
import { SearchableSelect } from '@/components/molecules/SearchableSelect'
import { oosService } from '@/api/services/mobile'
import { toast, notifyApiError } from '@/features/toast'
import { serializeAttachments, type AttachmentMeta } from '@/utils/attachments'

interface OosRequestTabProps {
  onComplete: () => void
}

export function OosRequestTab({ onComplete }: OosRequestTabProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // Queries
  const reasonsQuery = useQuery({
    queryKey: ['oos', 'reasons'],
    queryFn: () => oosService.listReasons(),
  })

  // Form State
  const [reasonId, setReasonId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [expectedDeliverables, setExpectedDeliverables] = useState('')
  const [remarks, setRemarks] = useState('')
  const [destinationName, setDestinationName] = useState('')
  const [destinationAddress, setDestinationAddress] = useState('')
  const [mapCoords, setMapCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([])

  const [formAlert, setFormAlert] = useState<{ type: FormStatusType; message: string } | null>(null)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const reasonOptions = useMemo(() => {
    const list = Array.isArray(reasonsQuery.data)
      ? reasonsQuery.data
      : (reasonsQuery.data as { data?: any[] })?.data
    if (!Array.isArray(list)) return []
    return list.map((r: any) => ({
      value: String(r.id ?? r.ID ?? ''),
      label: String(r.reason ?? r.Reason ?? ''),
    }))
  }, [reasonsQuery.data])

  const createMutation = useMutation({
    mutationFn: (submit: boolean) =>
      oosService.createRequest({
        reason_id: Number(reasonId),
        start_date: startDate,
        end_date: endDate,
        remarks: remarks || undefined,
        expected_deliverables: expectedDeliverables,
        attachment_url: serializeAttachments(attachments),
        destination_name: destinationName,
        destination_address: destinationAddress || undefined,
        destination_latitude: mapCoords!.latitude,
        destination_longitude: mapCoords!.longitude,
        geofence_radius_meters: 500,
        submit,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oos'] })
      // Reset form
      setReasonId('')
      setStartDate('')
      setEndDate('')
      setExpectedDeliverables('')
      setRemarks('')
      setDestinationName('')
      setDestinationAddress('')
      setMapCoords(null)
      setAttachments([])
      setFormAlert(null)

      toast.success(t('oos_success_submit', 'Travel request submitted for approval.'), 'Travel')
      onComplete()
    },
    onError: (err: unknown) => {
      notifyApiError(err, 'Could not submit travel request')
      setFormAlert({
        type: 'error',
        message: err instanceof Error ? err.message : 'An error occurred while submitting your travel request.',
      })
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setFormAlert(null)

    if (!reasonId) {
      setFormAlert({ type: 'warning', message: 'Select a travel reason.' })
      return
    }
    if (!startDate || !endDate) {
      setFormAlert({ type: 'warning', message: 'Enter start and end dates.' })
      return
    }

    const todayStr = new Date().toISOString().split('T')[0]
    if (startDate < todayStr || endDate < todayStr) {
      setFormAlert({ type: 'warning', message: t('oos_error_past_dates', 'Out-of-station requests cannot use past dates.') })
      return
    }
    if (endDate < startDate) {
      setFormAlert({ type: 'warning', message: t('oos_error_end_date_before_start', 'End date cannot be before the start date.') })
      return
    }

    if (!destinationName || !mapCoords) {
      setFormAlert({ type: 'warning', message: 'Search and select your destination on Google Maps.' })
      return
    }
    if (!expectedDeliverables.trim()) {
      setFormAlert({ type: 'warning', message: 'Describe the expected deliverables for this trip.' })
      return
    }

    createMutation.mutate(true)
  }

  const today = startOfDay(new Date())

  return (
    <form onSubmit={handleSubmit} className="flex-1 px-4 py-3 max-w-3xl mx-auto w-full">
      <div className="pb-12">
        {formAlert && (
          <div className="mb-6 cursor-pointer" onClick={() => setFormAlert(null)}>
            <FormStatusAlert type={formAlert.type} message={formAlert.message} onDismiss={() => setFormAlert(null)} />
          </div>
        )}

        {/* Offline Blocker Banner matching Mobile */}
        {isOffline && (
          <div
            className="p-4 border mb-6 flex items-start gap-3"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.06)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-red-600 dark:text-red-400 mb-1">
                {t('oos_error_internet_required', 'Internet Connection Required')}
              </h4>
              <p className="text-xs leading-relaxed text-red-500 dark:text-red-400/80">
                {t(
                  'oos_error_internet_required_desc',
                  'Applying for travel assignments requires an active internet connection to load map search and geocoding services. Please check your network and try again.',
                )}
              </p>
            </div>
          </div>
        )}

        {/* Reason Select Option */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-ui-text mb-2">
            {t('oos_form_reason', 'Travel Reason')}
          </label>
          <SearchableSelect
            label=""
            labelPosition="top"
            value={reasonId}
            placeholder={t('oos_form_reason_placeholder', 'Select travel reason...')}
            emptyLabel="Select travel reason"
            allowClear={false}
            options={reasonOptions}
            onChange={setReasonId}
          />
        </div>

        {/* Travel Period Selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <DatePickerField
            label={t('oos_form_start_date', 'Start Date')}
            value={startDate}
            onChange={setStartDate}
            minDate={today}
            className="rounded-none"
          />
          <DatePickerField
            label={t('oos_form_end_date', 'End Date')}
            value={endDate}
            onChange={setEndDate}
            minDate={startDate ? parseISO(startDate) : today}
            className="rounded-none"
          />
        </div>

        {/* Destination Search with Autocomplete */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-ui-text mb-2">
            {t('oos_form_destination_name', 'Destination Facility/Name')}
          </label>
          <PlaceAutocompleteField
            label=""
            value={destinationName}
            placeholder={t('oos_form_destination_name_placeholder', 'e.g., Mbale Regional Referral Hospital')}
            onChange={(text) => {
              setDestinationName(text)
              if (!text) {
                setDestinationAddress('')
                setMapCoords(null)
              }
            }}
            onPlaceSelect={(place: PlaceSelection) => {
              setDestinationName(place.name)
              setDestinationAddress(place.address)
              setMapCoords({ latitude: place.latitude, longitude: place.longitude })
            }}
          />
        </div>

        {/* Destination Address — auto-populated, editable */}
        {destinationAddress.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-ui-text mb-1">
              {t('oos_form_destination_address', 'Destination Address')}
            </label>
            <input
              type="text"
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
              placeholder={t('oos_form_destination_address_placeholder', 'e.g., Pallisa Road, Mbale')}
              className="w-full px-3 py-2 border border-ui-border bg-ui-surface text-sm text-ui-text rounded-none focus:outline-none focus:border-emerald-600"
            />
          </div>
        )}

        {/* Fine-tune Location on Map matching Mobile */}
        {mapCoords && (
          <OosLocationPickerMap
            coords={mapCoords}
            onLocationChange={(newCoords, address) => {
              setMapCoords(newCoords)
              if (address) {
                setDestinationAddress(address)
              }
            }}
          />
        )}

        {/* Expected Deliverables */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-ui-text mb-1">
            {t('oos_form_deliverables', 'Expected Deliverables')}
          </label>
          <textarea
            rows={3}
            value={expectedDeliverables}
            onChange={(e) => setExpectedDeliverables(e.target.value)}
            placeholder={t(
              'oos_form_deliverables_placeholder',
              'Describe outputs or reports expected from this travel assignment...',
            )}
            className="w-full px-3 py-2 border border-ui-border bg-ui-surface text-sm text-ui-text rounded-none focus:outline-none focus:border-emerald-600"
          />
        </div>

        {/* Remarks */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-ui-text mb-1">
            {t('oos_form_remarks', 'Remarks')}
          </label>
          <textarea
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder={t('oos_form_remarks_placeholder', 'Any additional information or details...')}
            className="w-full px-3 py-2 border border-ui-border bg-ui-surface text-sm text-ui-text rounded-none focus:outline-none focus:border-emerald-600"
          />
        </div>

        {/* Supporting Travel Documents */}
        <div className="mb-6">
          <FileAttachmentField
            label={t('oos_form_supporting_docs', 'Supporting Travel Documents')}
            value={attachments}
            onChange={setAttachments}
          />
        </div>

        {/* Submit Button matching Mobile style */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={createMutation.isPending || isOffline}
            className="w-full py-3 px-4 bg-[#15803D] hover:bg-[#15803D]/90 text-white font-bold text-sm rounded-none transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {createMutation.isPending
              ? 'Submitting...'
              : t('oos_form_submit', 'Submit for Supervisor Approval')}
          </button>
        </div>
      </div>
    </form>
  )
}
