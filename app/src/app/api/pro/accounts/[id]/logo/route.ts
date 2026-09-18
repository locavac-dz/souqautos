import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { saveProLogo, deleteStoredFile, PhotoValidationError } from "@/lib/uploads";

// Lot 103 — logo/bannière réservés au propriétaire du compte pro, jamais
// délégables à un collaborateur : même règle que la gestion des
// collaborateurs eux-mêmes (cf. canManageCollaborators, src/lib/pro-account.ts)
// — l'identité visuelle de la boutique n'est pas une tâche opérationnelle.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.professionalAccount?.id !== id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!(await checkRateLimit(`upload-pro-logo:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  let logoUrl: string;
  try {
    logoUrl = await saveProLogo(file);
  } catch (error) {
    if (error instanceof PhotoValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const previous = await prisma.professionalAccount.findUnique({ where: { id }, select: { logoUrl: true } });
  await prisma.professionalAccount.update({ where: { id }, data: { logoUrl } });
  if (previous?.logoUrl) await deleteStoredFile(previous.logoUrl);

  return NextResponse.json({ logoUrl });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.professionalAccount?.id !== id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const previous = await prisma.professionalAccount.findUnique({ where: { id }, select: { logoUrl: true } });
  await prisma.professionalAccount.update({ where: { id }, data: { logoUrl: null } });
  if (previous?.logoUrl) await deleteStoredFile(previous.logoUrl);

  return NextResponse.json({ ok: true });
}
