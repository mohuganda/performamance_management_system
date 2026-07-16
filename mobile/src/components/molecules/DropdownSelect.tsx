import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { useTheme } from '../../app/hooks/useTheme';

interface Option {
  id: string | number;
  name: string;
}

interface DropdownSelectProps {
  label?: string;
  placeholder?: string;
  options: Option[];
  selectedValue?: string | number | null;
  onSelect: (option: Option) => void;
  error?: string;
  loading?: boolean;
  className?: string;
}

export const DropdownSelect: React.FC<DropdownSelectProps> = ({
  label,
  placeholder = 'Select an option...',
  options,
  selectedValue,
  onSelect,
  error,
  loading = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { colors } = useTheme();

  const selectedOption = options.find((opt) => String(opt.id) === String(selectedValue));

  return (
    <View className={`space-y-2 ${className}`}>
      {label && (
        <Text className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
          {label}
        </Text>
      )}

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setIsOpen(!isOpen)}
        className="w-full bg-white dark:bg-zinc-950 border flex-row items-center justify-between rounded-none px-4 py-3"
        style={{
          borderColor: error ? colors.error : colors.border,
        }}
      >
        <Text
          className="text-base"
          style={{ color: selectedOption ? colors.text : colors.muted }}
        >
          {selectedOption ? selectedOption.name : placeholder}
        </Text>
        <ChevronDown size={18} color={colors.muted} />
      </TouchableOpacity>

      {error && (
        <Text className="text-xs text-[#D90000] font-medium mt-0.5">
          {error}
        </Text>
      )}

      {isOpen && (
        <View
          className="p-2 border rounded-none max-h-48 overflow-hidden mt-1"
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
          }}
        >
          <ScrollView nestedScrollEnabled={true}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} className="py-4" />
            ) : (
              options.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => {
                    onSelect(opt);
                    setIsOpen(false);
                  }}
                  className="p-3 rounded-none border-b last:border-b-0"
                  style={{ borderBottomColor: colors.border }}
                >
                  <Text className="text-base font-semibold" style={{ color: colors.text }}>
                    {opt.name}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
};
export default DropdownSelect;
