import { z } from 'zod';

export const leaveRequestSchema = z.object({
  leave_type_id: z.string().min(1, { message: 'Please select a leave type' }),
  start_date: z.string().min(1, { message: 'Start date is required' }),
  end_date: z.string().min(1, { message: 'End date is required' }),
  reason: z
    .string()
    .min(10, { message: 'Reason must be at least 10 characters long' })
    .max(1000, { message: 'Reason must be under 1000 characters' }),
});

export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>;
export default leaveRequestSchema;
