import { z } from 'zod';

export const attendanceNotesSchema = z.object({
  notes: z
    .string()
    .max(500, { message: 'Notes must be under 500 characters' })
    .optional()
    .or(z.literal('')),
});

export type AttendanceNotesInput = z.infer<typeof attendanceNotesSchema>;
export default attendanceNotesSchema;
