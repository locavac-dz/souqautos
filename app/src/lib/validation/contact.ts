import { z } from "zod";
import { emailSchema } from "./auth";

export const CONTACT_SUBJECTS = [
  "general",
  "technical",
  "pro",
  "partnership",
  "other",
] as const;

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  subject: z.enum(CONTACT_SUBJECTS),
  message: z.string().trim().min(10).max(2000),
  honeypot: z.literal(""),
});
