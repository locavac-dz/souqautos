import { z } from "zod";
import { INT4_MAX } from "./int-bounds";
import { algerianPhoneRegex } from "./phone";

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  wilayaId: z.number().int().positive().max(INT4_MAX).optional(),
  phone: z.string().trim().regex(algerianPhoneRegex).optional(),
  bio: z.string().trim().max(500).optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
