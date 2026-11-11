import React, { useRef, useEffect } from 'react';
import SignaturePad from 'signature_pad';
import { X, RotateCcw, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SignaturePadModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (signatureDataUrl: string) => void;
}

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  visible,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (!visible || !canvasRef.current) return;

    const canvas = canvasRef.current;
    // Set display size and high-DPI scaling
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(ratio, ratio);

    signaturePadRef.current = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(0, 0, 0)',
    });

    return () => {
      signaturePadRef.current?.off();
    };
  }, [visible]);

  if (!visible) return null;

  const handleClear = () => {
    signaturePadRef.current?.clear();
  };

  const handleConfirm = () => {
    if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
      const dataUrl = signaturePadRef.current.toDataURL('image/png');
      onSave(dataUrl);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
            {t('profile_draw_signature', 'Draw Official Signature')}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Canvas Area */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center">
          <p className="text-xs text-zinc-500 mb-2">
            Sign within the box below using your finger or stylus
          </p>
          <div className="w-full h-56 bg-white border-2 border-dashed border-zinc-300 dark:border-zinc-700 shadow-inner rounded-none overflow-hidden touch-none relative">
            <canvas ref={canvasRef} className="w-full h-full block" />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex justify-between gap-3">
          <button
            onClick={handleClear}
            className="px-4 py-2.5 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold text-xs flex items-center gap-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <RotateCcw size={14} />
            {t('profile_clear', 'Clear')}
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2.5 bg-primary text-white dark:bg-white dark:text-zinc-950 font-bold text-xs flex items-center gap-1.5 hover:opacity-90 shadow"
          >
            <Check size={14} />
            {t('profile_save_signature', 'Save Signature')}
          </button>
        </div>
      </div>
    </div>
  );
};

