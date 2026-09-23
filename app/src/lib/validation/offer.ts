import { z } from "zod";

export const makeOfferSchema = z.object({
  amount:  z.number().int().min(1).max(1_000_000_000),
  message: z.string().max(500).optional(),
});

export const respondOfferSchema = z.object({
  action:        z.enum(["ACCEPTED", "DECLINED", "WITHDRAWN", "COUNTERED"]),
  counterAmount: z.number().int().min(1).max(1_000_000_000).optional(),
}).superRefine((v, ctx) => {
  if (v.action === "COUNTERED" && !v.counterAmount) {
    ctx.addIssue({ code: "custom", path: ["counterAmount"], message: "counterAmount requis pour COUNTERED" });
  }
});

export const updateOfferSchema = z.object({
  amount:  z.number().int().min(1).max(1_000_000_000),
  message: z.string().max(500).optional(),
});
