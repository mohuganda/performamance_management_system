import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Typography } from '@material-tailwind/react'
import { Eraser, ImagePlus, PenLine, Save } from 'lucide-react'
import { mt } from '@/utils/mt'
import { cn } from '@/utils/cn'

interface SignaturePadProps {
  value?: string | null
  onChange: (dataUrl: string | null) => void
  onSave?: (dataUrl: string) => Promise<void>
  saving?: boolean
  className?: string
}

const CANVAS_WIDTH = 320
const CANVAS_HEIGHT = 96

export function SignaturePad({
  value,
  onChange,
  onSave,
  saving = false,
  className,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const [dirty, setDirty] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2
    ctx.strokeStyle = '#1a1a1a'
    return ctx
  }, [])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = getCtx()
    if (!canvas || !ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1a1a1a'
  }, [getCtx])

  const loadImageToCanvas = useCallback(
    (src: string) => {
      const canvas = canvasRef.current
      const ctx = getCtx()
      if (!canvas || !ctx) return
      const img = new Image()
      img.onload = () => {
        clearCanvas()
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height, 1)
        const w = img.width * scale
        const h = img.height * scale
        const x = (canvas.width - w) / 2
        const y = (canvas.height - h) / 2
        ctx.drawImage(img, x, y, w, h)
        setDirty(true)
      }
      img.src = src
    },
    [clearCanvas, getCtx],
  )

  useEffect(() => {
    clearCanvas()
    if (value) {
      loadImageToCanvas(value)
    }
  }, [clearCanvas, loadImageToCanvas, value])

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = getCtx()
    if (!ctx) return
    drawingRef.current = true
    const { x, y } = pointerPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    const ctx = getCtx()
    if (!ctx) return
    const { x, y } = pointerPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setDirty(true)
  }

  const handlePointerUp = () => {
    drawingRef.current = false
  }

  const handleClear = () => {
    clearCanvas()
    setDirty(false)
    onChange(null)
  }

  const handleExport = (): string | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.toDataURL('image/png')
  }

  const handleSave = async () => {
    const dataUrl = handleExport()
    if (!dataUrl) return
    onChange(dataUrl)
    if (onSave) {
      await onSave(dataUrl)
    }
    setDirty(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      loadImageToCanvas(result)
      onChange(result)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="mx-auto w-full max-w-sm rounded-sm border-2 border-dashed border-moh-green/40 bg-gray-50 p-2">
        <Typography {...mt} className="mb-1.5 text-center text-xs font-medium uppercase text-gray-500">
          Sign within the frame below
        </Typography>
        <div className="mx-auto w-fit max-w-full overflow-hidden rounded-sm border border-gray-300 bg-white shadow-inner">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block h-24 w-80 max-w-full cursor-crosshair touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>
        <Typography {...mt} className="mt-1.5 text-center text-xs text-gray-400">
          Draw with mouse or finger, or upload a scanned signature image
        </Typography>
      </div>

      <div className="mx-auto flex max-w-sm flex-wrap gap-2">
        <Button
          {...mt}
          size="sm"
          variant="outlined"
          className="flex items-center gap-1 rounded-sm border-ui-border normal-case"
          onClick={handleClear}
        >
          <Eraser className="h-4 w-4" />
          Clear
        </Button>
        <Button
          {...mt}
          size="sm"
          variant="outlined"
          className="flex items-center gap-1 rounded-sm border-ui-border normal-case"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4" />
          Upload image
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileUpload}
        />
        <Button
          {...mt}
          size="sm"
          className="ml-auto flex items-center gap-1 rounded-sm bg-moh-green normal-case"
          onClick={() => void handleSave()}
          disabled={saving || !dirty}
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save signature'}
        </Button>
      </div>

      {value ? (
        <div className="mx-auto max-w-sm rounded-sm border border-moh-green/20 bg-moh-green/5 p-2">
          <div className="mb-1 flex items-center gap-1 text-xs font-medium text-moh-green">
            <PenLine className="h-3.5 w-3.5" />
            Saved signature on file
          </div>
          <img
            src={value}
            alt="Saved signature"
            className="mx-auto max-h-14 max-w-[200px] object-contain"
          />
        </div>
      ) : null}
    </div>
  )
}
