import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('login_email_error'),
  password: z.string().min(6, 'login_password_error'),
});

export const activationSchema = z.object({
  email: z.string().email('login_email_error'),
  token: z.string().min(1, 'activate_failed_error'),
  password: z.string().min(8, 'activate_failed_error'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'activate_password_mismatch_error',
  path: ['confirmPassword'],
});
