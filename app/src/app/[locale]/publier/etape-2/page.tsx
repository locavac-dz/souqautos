import { prisma } from "@/lib/prisma";
import { Step2Fields } from "./Step2Fields";

export default async function Step2Page() {
  const brands = await prisma.brand.findMany({
    include: {
      models: {
        orderBy: { name: "asc" },
        include: { generations: { orderBy: { yearStart: "desc" } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return <Step2Fields brands={brands} />;
}
