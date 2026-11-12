import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, Calendar, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, Clock } from 'lucide-react';
import { AppBar } from '../../components/organisms/AppBar';
import { Card } from '../../components/atoms/Card';
import { Badge } from '../../components/atoms/Badge';
import { Button } from '../../components/atoms/Button';
import { Input } from '../../components/atoms/Input';
import { MapCard } from '../../components/molecules/MapCard';
import { Toaster } from '../../utils/toast';
import { getApiErrorMessage } from '../../api/client';
import { useOosRequestsQuery } from '../../hooks/useOos';
import { useClockMutation } from '../../hooks/useAttendance';
import { ClockRequest } from '../../api/attendance/types';
import { getDistanceMeters } from '../../utils/haversine';
import { formatDate } from '../../utils/date';

export const OosDetailsScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Custom TanStack Query hooks
  const { data: requests = [], isLoading: isLoadingRequests } = useOosRequestsQuery();
  const request = useMemo(() => requests.find((r) => String(r.id) === String(id)), [requests, id]);
  const clockMutation = useClockMutation();

  // GPS Location & Proximity State
  const [coords, setCoords] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Attendance Shift State for this assignment
  const [notes, setNotes] = useState('');
  const [isClockedIn, setIsClockedIn] = useState(false);

  const fetchLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        setGeoError(err.message || 'GPS Signal lost.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }, []);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  // Destination coordinates
  const destinationCoords = useMemo(() => {
    if (!request) return { latitude: 0.3476, longitude: 32.5825 };
    return {
      latitude: request.destination_latitude || 0.3476,
      longitude: request.destination_longitude || 32.5825,
      name: request.destination_name,
    };
  }, [request]);

  const radius = request?.geofence_radius_meters || 500;

  // Haversine Proximity Calculation
  const { distanceMeters, isWithinGeofence } = useMemo(() => {
    if (!coords || !request) return { distanceMeters: null, isWithinGeofence: false };

    const dist = getDistanceMeters(
      coords.latitude,
      coords.longitude,
      destinationCoords.latitude,
      destinationCoords.longitude
    );

    return {
      distanceMeters: dist,
      isWithinGeofence: dist <= radius,
    };
  }, [coords, request, destinationCoords, radius]);

  const handleClockAction = async (clockType: 'in' | 'out') => {
    if (!coords) {
      Toaster.error('Acquiring high-accuracy GPS. Please ensure location is enabled.');
      fetchLocation();
      return;
    }

    if (clockType === 'in' && !isWithinGeofence) {
      Toaster.warning(
        `You are ${(distanceMeters! / 1000).toFixed(1)}km away. You must be within ${radius}m of ${request?.destination_name} to clock in.`
      );
      return;
    }

    const payload: ClockRequest = {
      action: clockType,
      clock_type: clockType,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy_meters: coords.accuracy,
      location_label: request?.destination_name,
      out_of_station_request_id: Number(id),
      notes: notes.trim() || undefined,
      clocked_at: new Date().toISOString(),
    };

    clockMutation.mutate(payload, {
      onSuccess: () => {
        setIsClockedIn(clockType === 'in');
        Toaster.success(
          clockType === 'in'
            ? `Clocked in for duty at ${request?.destination_name}`
            : `Clocked out from ${request?.destination_name}`
        );
        setNotes('');
      },
      onError: (err) => {
        Toaster.error(getApiErrorMessage(err, 'Failed to process travel attendance clock.'));
      },
    });
  };

  if (isLoadingRequests && !request) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
        <AppBar title="Travel Assignment" showBack />
        <div className="flex-1 flex items-center justify-center p-6 text-xs text-zinc-400">
          <RefreshCw size={20} className="animate-spin mr-2" />
          Loading assignment details...
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
        <AppBar title="Travel Assignment" showBack />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Assignment Not Found</p>
          <p className="text-xs text-zinc-400 mt-1">This clearance request may have been removed or updated.</p>
          <Button title="Back to Travel List" className="mt-4" onClick={() => navigate('/oos')} />
        </div>
      </div>
    );
  }

  const isApproved = request.status === 'approved';

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-20">
      <AppBar title="Assignment Details" showBack />

      <main className="max-w-md mx-auto p-4 space-y-4">
        {/* Top Header Card */}
        <Card className="p-4 space-y-2">
          <div className="flex items-start justify-between">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex-1 mr-2">
              {request.destination_name}
            </h2>
            <Badge
              label={request.status.toUpperCase()}
              variant={isApproved ? 'success' : request.status === 'rejected' ? 'error' : 'warning'}
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Calendar size={13} className="text-zinc-400" />
            <span>
              {formatDate(request.start_date)} — {formatDate(request.end_date)}
            </span>
          </div>

          {request.destination_address && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-1 pt-1">
              <MapPin size={12} className="text-zinc-400" />
              {request.destination_address}
            </p>
          )}
        </Card>

        {/* Map Geofence Card */}
        <div className="space-y-0">
          <MapCard
            coords={coords}
            targetCoords={destinationCoords}
            geofenceRadius={radius}
            isLocating={isLocating}
            geoError={geoError}
            onRefreshGps={fetchLocation}
            heightClass="h-56"
          />

          {/* Proximity HUD Banner */}
          <div
            className={`p-3 border -mt-4 mb-4 flex items-center justify-between ${
              isWithinGeofence
                ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900 text-green-800 dark:text-green-300'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {isWithinGeofence ? <ShieldCheck size={20} className="text-green-600" /> : <AlertTriangle size={20} className="text-amber-600" />}
              <div className="text-xs leading-tight">
                <p className="font-bold">
                  {isWithinGeofence ? 'Inside Assignment Zone' : 'Outside Assignment Zone'}
                </p>
                <p className="text-[11px] opacity-80 mt-0.5">
                  {distanceMeters !== null
                    ? isWithinGeofence
                      ? `${Math.round(distanceMeters)}m from target (Within ${radius}m limit)`
                      : `${(distanceMeters / 1000).toFixed(1)} km away — Must be within ${radius}m to clock in`
                    : 'Acquiring GPS location...'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Duty Clock-in Action Card */}
        <Card className="p-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Duty Station Attendance
          </h3>

          {!isApproved ? (
            <div className="p-3 bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
              Duty clock-in will be enabled once your supervisor approves this travel clearance.
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                label="Duty Log Remarks (Optional)"
                placeholder="Remarks about today's duty assignment..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              {isClockedIn ? (
                <Button
                  variant="danger"
                  title="Clock Out from Travel Duty Station"
                  onClick={() => handleClockAction('out')}
                  loading={clockMutation.isPending}
                />
              ) : (
                <div>
                  <Button
                    variant="primary"
                    title="Clock In for Travel Duty Station"
                    onClick={() => handleClockAction('in')}
                    disabled={!isWithinGeofence || clockMutation.isPending}
                    loading={clockMutation.isPending}
                  />
                  {!isWithinGeofence && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center mt-2">
                      Clock-in is locked until your device is within 500m of {request.destination_name}.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};
