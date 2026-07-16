import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import MapView, { Marker, Circle } from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import { MapPin, Navigation, Info } from 'lucide-react-native';
import { useTheme } from '../../../app/hooks/useTheme';
import { Input } from '../../../components/atoms/Input';
import { Button } from '../../../components/atoms/Button';
import { DropdownSelect } from '../../../components/molecules/DropdownSelect';
import { DateRangePicker } from '../../../components/molecules/DateRangePicker';
import { AttachmentPicker, AttachmentFile } from '../../../components/molecules/AttachmentPicker';
import { FormStatusAlert } from '../../../components/molecules/FormStatusAlert';
import { useOosReasonsQuery, useCreateOosMutation } from '../../../app/hooks/useOos';
import oosRequestSchema from '../../../app/schemas/oos';
import leaveService from '../../../api/leave/service';

const DEFAULT_COORDS = {
  latitude: 0.3476,
  longitude: 32.5825,
  latitudeDelta: 0.005,
  longitudeDelta: 0.005,
};

export function OosRequestTab({ onComplete }: { onComplete: () => void }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  // Queries & Mutations
  const { data: reasons, isLoading: isReasonsLoading } = useOosReasonsQuery();
  const createMutation = useCreateOosMutation();

  // Form State
  const [reasonId, setReasonId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expectedDeliverables, setExpectedDeliverables] = useState('');
  const [remarks, setRemarks] = useState('');
  const [destinationName, setDestinationName] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');

  // Map / Geolocation State
  const [mapCoords, setMapCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [region, setRegion] = useState(DEFAULT_COORDS);

  // Attachments State
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [formAlert, setFormAlert] = useState<{ type: 'error' | 'warning' | 'success'; message: string } | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Format reasons catalog for DropdownSelect option interface (id, name)
  const reasonOptions = useMemo(() => {
    if (!reasons) return [];
    return reasons.map((r) => ({
      id: r.id,
      name: r.reason,
    }));
  }, [reasons]);

  // Acquire user's current GPS position to center marker on map
  const handleUseCurrentLocation = () => {
    setIsLocating(true);
    setFormAlert(null);
    Geolocation.getCurrentPosition(
      (position) => {
        const newCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setMapCoords(newCoords);
        setRegion({
          ...newCoords,
          latitudeDelta: 0.003,
          longitudeDelta: 0.003,
        });
        setIsLocating(false);
      },
      (error) => {
        console.error('GPS error:', error);
        Alert.alert('Location Error', 'Unable to retrieve current coordinates. Please select manually on the map.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  // Convert picked attachment file to dataUrl for uploads
  const fileToDataUrl = async (uri: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleSubmit = async (submit: boolean) => {
    setFormAlert(null);
    setValidationErrors({});

    const formData = {
      reason_id: reasonId,
      start_date: startDate,
      end_date: endDate,
      expected_deliverables: expectedDeliverables,
      remarks: remarks || undefined,
      destination_name: destinationName,
      destination_address: destinationAddress || undefined,
      destination_latitude: mapCoords?.latitude,
      destination_longitude: mapCoords?.longitude,
      geofence_radius_meters: 500, // Hardcoded to 500m per user instructions
    };

    // Zod Validation
    const validationResult = oosRequestSchema.safeParse(formData);
    if (!validationResult.success) {
      const errors: Record<string, string> = {};
      validationResult.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          errors[issue.path[0] as string] = issue.message;
        }
      });
      setValidationErrors(errors);
      setFormAlert({ type: 'warning', message: 'Please correct the validation errors in the form.' });
      return;
    }

    // Business Date Validation
    const todayStr = new Date().toISOString().split('T')[0];
    if (startDate < todayStr || endDate < todayStr) {
      setFormAlert({ type: 'warning', message: t('oos_error_past_dates') });
      return;
    }
    if (endDate < startDate) {
      setFormAlert({ type: 'warning', message: t('oos_error_end_date_before_start') });
      return;
    }

    // Process File Uploads
    let uploadedUrls: string[] = [];
    setIsUploading(true);
    try {
      for (const file of attachments) {
        const dataUrl = await fileToDataUrl(file.uri);
        const res = await leaveService.uploadAttachment(dataUrl, file.name);
        uploadedUrls.push(res.url);
      }
    } catch (err) {
      console.error('Attachment upload failed:', err);
      setIsUploading(false);
      setFormAlert({ type: 'error', message: 'Failed to upload travel supporting documents.' });
      return;
    }
    setIsUploading(false);

    // Call Mutation hook
    const payload = {
      reason_id: Number(reasonId),
      start_date: startDate,
      end_date: endDate,
      expected_deliverables: expectedDeliverables,
      remarks: remarks || undefined,
      destination_name: destinationName,
      destination_address: destinationAddress || undefined,
      destination_latitude: mapCoords!.latitude,
      destination_longitude: mapCoords!.longitude,
      geofence_radius_meters: 500,
      attachment_url: uploadedUrls.length > 0 ? uploadedUrls[0] : undefined, // simple single-string url payload
      submit,
    };

    createMutation.mutate(payload, {
      onSuccess: (res) => {
        // Reset form
        setReasonId('');
        setStartDate('');
        setEndDate('');
        setExpectedDeliverables('');
        setRemarks('');
        setDestinationName('');
        setDestinationAddress('');
        setMapCoords(null);
        setAttachments([]);

        if (res?.offline) {
          Alert.alert('Offline Mode', t('oos_success_queued'), [{ text: 'OK', onPress: onComplete }]);
        } else {
          Alert.alert('Success', t('oos_success_submit'), [{ text: 'OK', onPress: onComplete }]);
        }
      },
      onError: (err) => {
        setFormAlert({ type: 'error', message: err.message || 'An error occurred while submitting your travel request.' });
      },
    });
  };

  return (
    <ScrollView className="flex-1 px-4 py-3" showsVerticalScrollIndicator={false}>
      <View className="pb-12">
        {formAlert && (
          <TouchableOpacity onPress={() => setFormAlert(null)} activeOpacity={0.9} className="mb-6">
            <FormStatusAlert type={formAlert.type} message={formAlert.message} />
          </TouchableOpacity>
        )}

        {/* Reason Select Option */}
        <View className="space-y-1 mb-6">
          <Text className="text-sm font-semibold" style={{ color: colors.text }}>
            {t('oos_form_reason')}
          </Text>
          {isReasonsLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <DropdownSelect
              label=""
              placeholder={t('oos_form_reason_placeholder')}
              options={reasonOptions}
              selectedValue={reasonId}
              onSelect={(opt) => setReasonId(String(opt.id))}
              error={validationErrors.reason_id}
            />
          )}
        </View>

        {/* Travel Period Selector */}
        <DateRangePicker
          startDate={startDate || null}
          endDate={endDate || null}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          startLabel={t('oos_form_start_date')}
          endLabel={t('oos_form_end_date')}
          startError={validationErrors.start_date}
          endError={validationErrors.end_date}
          className="mb-6"
        />

        {/* Interactive Map Picker Section */}
        <View className="space-y-2 mb-6">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-sm font-semibold" style={{ color: colors.text }}>
              Select Destination Location
            </Text>
            <TouchableOpacity
              onPress={handleUseCurrentLocation}
              disabled={isLocating}
              className="flex-row items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 border"
              style={{ borderColor: colors.border }}
            >
              <Navigation size={12} color={colors.text} />
              <Text className="text-xs font-bold" style={{ color: colors.text }}>
                {t('oos_btn_current_location')}
              </Text>
            </TouchableOpacity>
          </View>

          {isLocating && (
            <View className="h-48 justify-center items-center bg-gray-100 dark:bg-zinc-900 border" style={{ borderColor: colors.border }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text className="text-xs mt-2" style={{ color: colors.muted }}>Locating device...</Text>
            </View>
          )}

          {!isLocating && (
            <View className="h-48 w-full border relative overflow-hidden" style={{ borderColor: colors.border }}>
              <MapView
                style={StyleSheet.absoluteFill}
                region={region}
                onRegionChangeComplete={setRegion}
                onPress={(e) => {
                  setMapCoords(e.nativeEvent.coordinate);
                }}
                userInterfaceStyle={isDark ? 'dark' : 'light'}
              >
                {mapCoords && (
                  <>
                    <Marker
                      coordinate={mapCoords}
                      draggable
                      onDragEnd={(e) => {
                        setMapCoords(e.nativeEvent.coordinate);
                      }}
                    />
                    <Circle
                      center={mapCoords}
                      radius={500}
                      fillColor="rgba(21, 128, 61, 0.15)"
                      strokeColor={colors.success}
                      strokeWidth={1.5}
                    />
                  </>
                )}
              </MapView>
            </View>
          )}
          {validationErrors.destination_latitude && (
            <Text className="text-xs text-red-500 font-medium mt-1">{validationErrors.destination_latitude}</Text>
          )}
        </View>

        {/* Destination Facility Input Details */}
        <Input
          label={t('oos_form_destination_name')}
          placeholder={t('oos_form_destination_name_placeholder')}
          value={destinationName}
          onChangeText={setDestinationName}
          error={validationErrors.destination_name}
          className="mb-6"
        />

        <Input
          label={t('oos_form_destination_address')}
          placeholder={t('oos_form_destination_address_placeholder')}
          value={destinationAddress}
          onChangeText={setDestinationAddress}
          error={validationErrors.destination_address}
          className="mb-6"
        />

        {/* Display Radius Geofence details */}
        <View className="p-4 border flex-row items-center gap-3 bg-zinc-50 dark:bg-zinc-900/50 mb-6" style={{ borderColor: colors.border }}>
          <Info size={16} color={colors.muted} />
          <Text className="text-xs flex-1" style={{ color: colors.muted }}>
            Verification Radius is fixed to <Text className="font-bold">500 meters</Text>. You must check in within 500m of this location to verify attendance.
          </Text>
        </View>

        {/* Expected Deliverables */}
        <Input
          label={t('oos_form_deliverables')}
          placeholder={t('oos_form_deliverables_placeholder')}
          value={expectedDeliverables}
          onChangeText={setExpectedDeliverables}
          multiline
          numberOfLines={3}
          error={validationErrors.expected_deliverables}
          className="mb-6"
        />

        {/* Remarks */}
        <Input
          label={t('oos_form_remarks')}
          placeholder={t('oos_form_remarks_placeholder')}
          value={remarks}
          onChangeText={setRemarks}
          multiline
          numberOfLines={2}
          error={validationErrors.remarks}
          className="mb-6"
        />

        {/* Attachments Supporting Document Picker */}
        <View className="space-y-1 mb-6">
          <Text className="text-sm font-semibold mb-2" style={{ color: colors.text }}>
            {t('oos_form_supporting_docs')}
          </Text>
          <AttachmentPicker
            attachments={attachments}
            onAttachmentsChange={setAttachments}
          />
        </View>

        {/* Submitting options */}
        <View className="pt-2">
          <Button
            title={t('oos_form_submit')}
            onPress={() => handleSubmit(true)}
            loading={createMutation.isPending || isUploading}
            disabled={createMutation.isPending || isUploading}
            className="bg-[#15803D] dark:bg-green-600"
          />
        </View>
      </View>
    </ScrollView>
  );
}
export default OosRequestTab;
