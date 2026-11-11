import { z } from 'zod';

export const updateProfileSchema = z.object({
  profile_photo: z.string().optional(),
  signature_image: z.string().optional(),
});

export type UpdateProfileFormValues = z.infer<typeof updateProfileSchema>;
