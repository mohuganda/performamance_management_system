import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MapPin } from 'lucide-react-native';
import { useTheme } from '../../app/hooks/useTheme';
import { GooglePlacePrediction } from '../../api/maps/types';

interface PlacesSearchInputProps {
  /** Label shown above the input */
  label?: string;
  /** Current value of the text input */
  value: string;
  /** Called on every keystroke */
  onChangeText: (text: string) => void;
  /** Called when the clear (✕) button is pressed */
  onClear: () => void;
  /** Autocomplete predictions to render below the input */
  predictions: GooglePlacePrediction[];
  /** Called when a prediction row is tapped */
  onSelectPrediction: (prediction: GooglePlacePrediction) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Validation error message */
  error?: string;
  /** Whether to disable input (e.g. offline) */
  disabled?: boolean;
  /** Whether a geocoding / detail resolution is in progress */
  isResolving?: boolean;
  /** Additional classname for the root wrapper */
  className?: string;
}

export const PlacesSearchInput: React.FC<PlacesSearchInputProps> = ({
  label,
  value,
  onChangeText,
  onClear,
  predictions,
  onSelectPrediction,
  placeholder = 'Search for a location...',
  error,
  disabled = false,
  isResolving = false,
  className = '',
}) => {
  const { colors, isDark } = useTheme();

  return (
    <View className={`${className}`}>
      {/* Label row */}
      {(label || isResolving) && (
        <View className="flex-row justify-between items-center mb-2">
          {label ? (
            <Text className="text-sm font-semibold" style={{ color: colors.text }}>
              {label}
            </Text>
          ) : <View />}
          {isResolving && (
            <View className="flex-row items-center gap-1.5">
              <ActivityIndicator size="small" color="#3B82F6" />
              <Text className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                Resolving...
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Search input box */}
      <View
        className={`w-full bg-white dark:bg-zinc-900 border ${error ? 'border-[#D90000] dark:border-red-500' : 'border-gray-200 dark:border-zinc-700'} px-4 py-3 flex-row items-center`}
        style={{
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <MapPin size={16} color={colors.muted} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
          className="flex-1 ml-2 text-base text-gray-900 dark:text-zinc-50 p-0"
          editable={!disabled}
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Text className="text-xs px-1" style={{ color: colors.muted }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Autocomplete predictions dropdown */}
      {predictions.length > 0 && (
        <View
          className="border border-t-0 bg-white dark:bg-zinc-900"
          style={{ borderColor: colors.border }}
        >
          {predictions.map((pred, idx) => (
            <TouchableOpacity
              key={pred.place_id}
              onPress={() => onSelectPrediction(pred)}
              className="px-4 py-3 flex-row items-start gap-3"
              style={{
                borderBottomWidth: idx < predictions.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}
            >
              <MapPin size={14} color={colors.muted} style={{ marginTop: 2 }} />
              <View className="flex-1">
                <Text
                  className="text-sm font-semibold"
                  style={{ color: colors.text }}
                  numberOfLines={1}
                >
                  {pred.structured_formatting?.main_text ?? pred.description.split(',')[0]}
                </Text>
                {pred.structured_formatting?.secondary_text ? (
                  <Text
                    className="text-xs mt-0.5"
                    style={{ color: colors.muted }}
                    numberOfLines={1}
                  >
                    {pred.structured_formatting.secondary_text}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Validation error */}
      {error && (
        <Text className="text-xs text-red-500 font-medium mt-1">{error}</Text>
      )}
    </View>
  );
};

export default PlacesSearchInput;
