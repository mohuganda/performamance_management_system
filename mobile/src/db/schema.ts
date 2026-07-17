import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'attendance_logs',
      columns: [
        { name: 'remote_id', type: 'number', isOptional: true },
        { name: 'action', type: 'string' },
        { name: 'clocked_at', type: 'string' },
        { name: 'created_at', type: 'string', isOptional: true },
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
        { name: 'accuracy_meters', type: 'number', isOptional: true },
        { name: 'verified', type: 'boolean', isOptional: true },
        { name: 'within_geofence', type: 'boolean', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'location_label', type: 'string', isOptional: true },
        { name: 'verification_status', type: 'string', isOptional: true },
        { name: 'distance_from_destination_meters', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'leave_requests',
      columns: [
        { name: 'remote_id', type: 'number', isOptional: true },
        { name: 'leave_type_id', type: 'number' },
        { name: 'start_date', type: 'string' },
        { name: 'end_date', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'reason', type: 'string' },
        { name: 'medical_report_url', type: 'string', isOptional: true },
        { name: 'days_requested', type: 'number', isOptional: true },
      ],
    }),
  ],
});
