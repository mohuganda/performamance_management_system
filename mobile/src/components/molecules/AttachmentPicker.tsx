import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { pick, types, errorCodes } from '@react-native-documents/picker';
import { Upload, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../app/hooks/useTheme';

export interface AttachmentFile {
  uri: string;
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
  allowedTypes?: any[];
  placeholderText?: string;
  subText?: string;
  className?: string;
}

export const AttachmentPicker: React.FC<AttachmentPickerProps> = ({
  label,
  required = false,
  requiredWarningText,
  attachments,
  onAttachmentsChange,
  allowMultiple = true,
  allowedTypes = [types.images, types.pdf],
  placeholderText = 'Select Files',
  subText = 'Upload Supporting Images or PDF certificates',
  className,
}) => {
  const { colors } = useTheme();

  const handlePickDocument = async () => {
    try {
      const res = await pick({
        type: allowedTypes,
        allowMultiSelection: allowMultiple,
      });

      const newFiles = res.map((file) => ({
        uri: file.uri,
        name: file.name ?? 'document.pdf',
        type: file.type ?? 'application/pdf',
        size: file.size ?? undefined,
      }));

      if (allowMultiple) {
        onAttachmentsChange([...attachments, ...newFiles]);
      } else {
        onAttachmentsChange(newFiles);
      }
    } catch (err: any) {
      if (err?.code !== errorCodes.OPERATION_CANCELED) {
        console.error('Document picking error:', err);
      }
    }
  };

  const handleRemoveAttachment = (index: number) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== index));
  };

  return (
    <View className={`${className} space-y-3`}>
      {(label || requiredWarningText) && (
        <View className="flex-row items-center justify-between">
          {label && (
            <Text className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
              {label}
              {required && <Text className="text-[#D90000]"> *</Text>}
            </Text>
          )}
          {requiredWarningText && (
            <Text className="text-xs text-red-500 font-bold">{requiredWarningText}</Text>
          )}
        </View>
      )}

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handlePickDocument}
        className="w-full border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-none p-6 items-center justify-center bg-white dark:bg-zinc-900"
      >
        <Upload size={24} color={colors.muted} className="mb-2" />
        <Text className="text-sm font-bold text-gray-700 dark:text-zinc-300">{placeholderText}</Text>
        {subText && <Text className="text-xs text-gray-400 mt-1">{subText}</Text>}
      </TouchableOpacity>

      {attachments.length > 0 && (
        <View className="space-y-2">
          {attachments.map((file, index) => (
            <View
              key={index}
              className="flex-row justify-between items-center bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-none p-3"
            >
              <View className="flex-1 pr-2">
                <Text className="text-sm font-semibold truncate" style={{ color: colors.text }}>
                  {file.name}
                </Text>
                {file.size && (
                  <Text className="text-xs text-gray-400">
                    {Math.round(file.size / 1024)} KB
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => handleRemoveAttachment(index)}>
                <Trash2 size={16} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};
export default AttachmentPicker;
