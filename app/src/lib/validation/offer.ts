import { z } from "zod";

export const makeOfferSchema = z.object({
  amount:  z.number().int().min(1).max(1_000_000_000),
  message: z.string().max(500).optional(),
});

export const respondOfferSchema = z.object({
  action: z.enum(["ACCEPTED", "DECLINED", "WITHDRAWN"]),
});
