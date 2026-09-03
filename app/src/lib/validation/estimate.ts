import { z } from "zod";

const numeric = () =>
  z
    .string()
    .trim()
    .regex(/^\d+$/)
    .transform(Number)
    .optional()
    .catch(undefined);

export const estimateParamsSchema = z.object({
  brandId: numeric(),
  modelId: numeric(),
  year: numeric(),
  mileage: numeric(),
  wilayaId: numeric(),
});

export type EstimateParams = z.infer<typeof estimateParamsSchema>;
