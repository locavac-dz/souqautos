import { prisma } from "@/lib/prisma";
import { Step4Fields } from "./Step4Fields";

export default async function Step4Page() {
  const equipments = await prisma.equipment.findMany({
    orderBy: { nameFr: "asc" },
    select: { id: true, nameFr: true, nameAr: true, category: true },
  });

  return <Step4Fields equipments={equipments} />;
}
