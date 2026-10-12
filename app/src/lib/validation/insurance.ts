import { z } from "zod";

export const quoteRequestSchema = z.object({
  fiscalPower: z.number().int().min(1).max(99),
  year: z.number().int().min(1970).max(new Date().getFullYear() + 1),
  wilayaId: z.number().int().min(1).max(69),
  formula: z.enum(["rc", "rc_tiers", "tous_risques"]),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(9).max(15),
  email: z.string().trim().email().max(200),
  honeypot: z.literal(""),
});

export type QuoteRequest = z.infer<typeof quoteRequestSchema>;
