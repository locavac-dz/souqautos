import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { Step8Fields } from "./Step8Fields";

export default async function Step8Page() {
  const [wilayas, user] = await Promise.all([
    prisma.wilaya.findMany({ orderBy: { id: "asc" } }),
    getCurrentUser(),
  ]);

  return <Step8Fields wilayas={wilayas} userPhone={user?.phone ?? null} />;
}
