import { useRef, useState } from 'react'
import { Button, Typography } from '@material-tailwind/react'
import { FileText, ImageIcon, Paperclip, X } from 'lucide-react'
import { uploadService } from '@/api/services/mobile'
import { notifyApiError } from '@/features/toast'
import {
  isImageAttachment,
  readFileAsDataUrl,
  resolveFileUrl,
  type AttachmentMeta,
} from '@/utils/attachments'
import { mt } from '@/utils/mt'
import { cn } from '@/utils/cn'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf'
const MAX_FILES = 5

type FileAttachmentFieldProps = {
  label?: string
  hint?: string
  value: AttachmentMeta[]
  onChange: (items: AttachmentMeta[]) => void
  className?: string
}

export function FileAttachmentField({
  label = 'Attachments',
  hint,
  value,
  onChange,
  className,
}: FileAttachmentFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    if (value.length >= MAX_FILES) {
      notifyApiError(new Error(`You can attach up to ${MAX_FILES} files.`), 'Attachments')
      return
    }

    setUploading(true)
    try {
      const next = [...value]
      for (const file of Array.from(files)) {
        if (next.length >= MAX_FILES) break
        const dataUrl = await readFileAsDataUrl(file)
        const uploaded = await uploadService.uploadAttachment({
          data_url: dataUrl,
          file_name: file.name,
        })
        next.push({
          url: uploaded.url,
          name: uploaded.name || file.name,
          mime_type: uploaded.mime_type,
          size: uploaded.size,
        })
      }
      onChange(next)
    } catch (error) {
      notifyApiError(error, 'Could not upload attachment')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Typography {...mt} className="text-sm font-semibold text-ui-text">
            {label}
          </Typography>
          {hint ? <p className="mt-0.5 text-xs text-ui-muted">{hint}</p> : null}
        </div>
        <Button
          {...mt}
          type="button"
          size="sm"
          variant="outlined"
          className="rounded-sm normal-case"
          disabled={uploading || value.length >= MAX_FILES}
          onClick={() => inputRef.current?.click()}
        >
          <span className="inline-flex items-center gap-1.5">
            <Paperclip className="h-4 w-4" />
            {uploading ? 'Uploading…' : 'Add file'}
          </span>
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {value.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {value.map((item, index) => (
            <AttachmentPreviewCard key={`${item.url}-${index}`} item={item} onRemove={() => removeAt(index)} />
          ))}
        </div>
      ) : (
        <div className="rounded-sm border border-dashed border-ui-border bg-ui-subtle/30 px-4 py-6 text-center text-sm text-ui-muted">
          No files attached yet. Upload images or PDF documents (max {MAX_FILES} files, 5 MB each).
        </div>
      )}
    </div>
  )
}

function AttachmentPreviewCard({ item, onRemove }: { item: AttachmentMeta; onRemove: () => void }) {
  const url = resolveFileUrl(item.url)
  const isImage = isImageAttachment(item)
  const isPdf = (item.mime_type ?? '').includes('pdf') || item.url.toLowerCase().endsWith('.pdf')

  return (
    <div className="relative overflow-hidden rounded-sm border border-ui-border bg-white">
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 z-10 rounded-sm bg-white/90 p-1 shadow-sm ring-1 ring-ui-border"
        aria-label="Remove attachment"
      >
        <X className="h-4 w-4 text-ui-muted" />
      </button>
      <div className="flex min-h-[120px] items-center justify-center bg-ui-subtle/40">
        {isImage ? (
          <img src={url} alt={item.name} className="max-h-40 w-full object-contain" />
        ) : isPdf ? (
          <div className="flex flex-col items-center gap-2 px-4 py-6 text-ui-muted">
            <FileText className="h-10 w-10" />
            <span className="text-xs font-medium">PDF document</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 py-6 text-ui-muted">
            <ImageIcon className="h-10 w-10" />
            <span className="text-xs font-medium">Attachment</span>
          </div>
        )}
      </div>
      <div className="border-t border-ui-border px-3 py-2">
        <p className="truncate text-sm font-medium text-ui-text">{item.name}</p>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-moh-green hover:underline"
        >
          Open preview
        </a>
      </div>
    </div>
  )
}
