import { z } from 'zod';

export const oosRequestSchema = z.object({
  reason_id: z.string().min(1, { message: 'Please select a travel reason' }),
  start_date: z.string().min(1, { message: 'Start date is required' }),
  end_date: z.string().min(1, { message: 'End date is required' }),
  expected_deliverables: z
    .string()
    .min(10, { message: 'Expected deliverables must be at least 10 characters long' })
    .max(1000, { message: 'Expected deliverables must be under 1000 characters' }),
  remarks: z.string().optional(),
  destination_name: z.string().min(1, { message: 'Destination name is required' }),
  destination_address: z.string().optional(),
  destination_latitude: z.number({ message: 'Latitude coordinate is required' }),
  destination_longitude: z.number({ message: 'Longitude coordinate is required' }),
  geofence_radius_meters: z.number().default(500),
});

export type OosRequestInput = z.infer<typeof oosRequestSchema>;
export default oosRequestSchema;
