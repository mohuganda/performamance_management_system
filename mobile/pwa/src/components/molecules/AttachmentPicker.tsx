import React, { useRef } from 'react';
import { Upload, Trash2, FileText, Image as ImageIcon } from 'lucide-react';

export interface AttachmentFile {
  dataUrl: string;
  name: string;
  type: string;
  size?: number;
}

interface AttachmentPickerProps {
  label?: string;
  required?: boolean;
  requiredWarningText?: string;
  attachments: AttachmentFile[];
  onAttachmentsChange: (attachments: AttachmentFile[]) => void;
  allowMultiple?: boolean;
  placeholderText?: string;
  subText?: string;
}

export const AttachmentPicker: React.FC<AttachmentPickerProps> = ({
  label,
  required = false,
  requiredWarningText,
  attachments,
  onAttachmentsChange,
  allowMultiple = true,
  placeholderText = 'Upload Files',
  subText = 'Select supporting images or PDF documents',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: AttachmentFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const dataUrl = await readFileAsDataUrl(file);
      newAttachments.push({
        dataUrl,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
      });
    }

    if (allowMultiple) {
      onAttachmentsChange([...attachments, ...newAttachments]);
    } else {
      onAttachmentsChange(newAttachments);
    }

    // Reset input so same file can be re-selected if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleRemove = (index: number) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {(label || requiredWarningText) && (
        <div className="flex items-center justify-between">
          {label && (
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
              {label}
              {required && <span className="text-red-500"> *</span>}
            </label>
          )}
          {requiredWarningText && (
            <span className="text-xs text-red-500 font-bold">{requiredWarningText}</span>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple={allowMultiple}
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 flex flex-col items-center justify-center cursor-pointer hover:border-zinc-500 dark:hover:border-zinc-500 transition-colors text-center"
      >
        <Upload size={24} className="text-zinc-400 mb-2" />
        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{placeholderText}</p>
        {subText && <p className="text-xs text-zinc-400 mt-1">{subText}</p>}
      </div>

      {attachments.length > 0 && (
        <div className="space-y-2 mt-3">
          {attachments.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                {file.type.includes('image') ? (
                  <ImageIcon size={18} className="text-blue-500 flex-shrink-0" />
                ) : (
                  <FileText size={18} className="text-amber-500 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {file.name}
                  </p>
                  {file.size && (
                    <p className="text-[10px] text-zinc-400">
                      {Math.round(file.size / 1024)} KB
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="text-red-500 hover:text-red-700 p-1"
                aria-label="Remove"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

