import React from 'react';
import { MapPin, ShieldAlert, X } from 'lucide-react';
import { Button } from '../atoms/Button';

interface LocationPermissionModalProps {
  visible: boolean;
  isBlocked?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const LocationPermissionModal: React.FC<LocationPermissionModalProps> = ({
  visible,
  isBlocked = false,
  onCancel,
  onConfirm,
}) => {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl flex flex-col items-center text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center mb-4 text-red-600 dark:text-red-400">
          {isBlocked ? <ShieldAlert size={26} /> : <MapPin size={26} />}
        </div>

        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-2">
          {isBlocked ? 'Location Permission Blocked' : 'Location Access Required'}
        </h3>

        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
          {isBlocked
            ? 'Your browser has blocked location access. Please click the padlock or settings icon in your browser address bar to allow location permissions for this site.'
            : 'MoH Performance Management System uses your precise GPS coordinates to verify duty presence and 500m geofence station limits.'}
        </p>

        <div className="flex w-full gap-2">
          <Button variant="secondary" title="Cancel" onClick={onCancel} />
          <Button
            variant="primary"
            title={isBlocked ? 'I Understand' : 'Allow Access'}
            onClick={onConfirm}
          />
        </div>
      </div>
    </div>
  );
};

