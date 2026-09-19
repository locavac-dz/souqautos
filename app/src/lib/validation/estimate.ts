import { z } from "zod";
import { numeric } from "./search";

export const estimateParamsSchema = z.object({
  brandId: numeric(),
  modelId: numeric(),
  year: numeric(),
  mileage: numeric(),
  wilayaId: numeric(),
});

export type EstimateParams = z.infer<typeof estimateParamsSchema>;
