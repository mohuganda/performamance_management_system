import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { Calendar as CalendarIcon } from 'lucide-react-native';
import { useTheme } from '../../app/hooks/useTheme';
import { formatDisplayDate, parseISODate } from '../../utils/leavePolicy';

interface DateRangePickerProps {
  startDate: string | null; // ISO YYYY-MM-DD
  endDate: string | null; // ISO YYYY-MM-DD
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  startLabel?: string;
  endLabel?: string;
  startError?: string;
  endError?: string;
  minimumDate?: Date;
  className?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  startLabel = 'Start Date',
  endLabel = 'End Date',
  startError,
  endError,
  minimumDate,
  className = '',
}) => {
  const { colors } = useTheme();
  const [isStartPickerVisible, setStartPickerVisibility] = useState(false);
  const [isEndPickerVisible, setEndPickerVisibility] = useState(false);

  const minDate = minimumDate || new Date();

  return (
    <View className={`flex-row space-x-4 ${className}`}>
      {/* Start Date */}
      <View className="flex-1 space-y-2">
        {startLabel && (
          <Text className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
            {startLabel}
          </Text>
        )}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setStartPickerVisibility(true)}
          className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-none px-4 py-3 flex-row items-center justify-between"
          style={{ borderColor: startError ? colors.error : colors.border }}
        >
          <Text className="text-sm" style={{ color: startDate ? colors.text : colors.muted }}>
            {startDate ? formatDisplayDate(parseISODate(startDate)) : 'Select Date'}
          </Text>
          <CalendarIcon size={16} color={colors.muted} />
        </TouchableOpacity>
        {startError && (
          <Text className="text-xs text-[#D90000] font-medium mt-0.5">
            {startError}
          </Text>
        )}
      </View>

      {/* End Date */}
      <View className="flex-1 space-y-2">
        {endLabel && (
          <Text className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
            {endLabel}
          </Text>
        )}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setEndPickerVisibility(true)}
          className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-none px-4 py-3 flex-row items-center justify-between"
          style={{ borderColor: endError ? colors.error : colors.border }}
        >
          <Text className="text-sm" style={{ color: endDate ? colors.text : colors.muted }}>
            {endDate ? formatDisplayDate(parseISODate(endDate)) : 'Select Date'}
          </Text>
          <CalendarIcon size={16} color={colors.muted} />
        </TouchableOpacity>
        {endError && (
          <Text className="text-xs text-[#D90000] font-medium mt-0.5">
            {endError}
          </Text>
        )}
      </View>

      {/* DateTime Picker Modals */}
      <DateTimePickerModal
        isVisible={isStartPickerVisible}
        mode="date"
        minimumDate={minDate}
        onConfirm={(date) => {
          setStartPickerVisibility(false);
          const iso = date.toISOString().split('T')[0];
          onStartDateChange(iso);
        }}
        onCancel={() => setStartPickerVisibility(false)}
      />

      <DateTimePickerModal
        isVisible={isEndPickerVisible}
        mode="date"
        minimumDate={startDate ? parseISODate(startDate) : minDate}
        onConfirm={(date) => {
          setEndPickerVisibility(false);
          const iso = date.toISOString().split('T')[0];
          onEndDateChange(iso);
        }}
        onCancel={() => setEndPickerVisibility(false)}
      />
    </View>
  );
};
export default DateRangePicker;
