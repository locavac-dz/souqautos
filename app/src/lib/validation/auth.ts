import { z } from "zod";

export const registerSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email: z.email().max(255),
  password: z.string().min(8).max(200),
  wilayaId: z.number().int().positive().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(1).max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;
