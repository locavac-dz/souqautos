import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/auth-server/roles";
import { readIdentityDocument } from "@/lib/identity-uploads";
import { writeAuditLog } from "@/lib/audit-log";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(isStaff);
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const identityRequest = await prisma.identityVerificationRequest.findUnique({ where: { id } });
  if (!identityRequest || !identityRequest.documentPath || !identityRequest.documentMime) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const buffer = await readIdentityDocument(identityRequest.documentPath);
  if (!buffer) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Une pièce d'identité est une donnée personnelle sensible désormais
  // chiffrée au repos (Lot 54) : consigner qui la consulte, et quand, ferme
  // la boucle « chiffré + audité » plutôt que de s'arrêter au chiffrement seul.
  await writeAuditLog({
    adminId: user.id,
    action: "identity_verification.document_view",
    targetType: "IdentityVerificationRequest",
    targetId: id,
    details: { requesterId: identityRequest.userId },
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": identityRequest.documentMime,
      "Content-Disposition": "inline",
      "Cache-Control": "no-store",
    },
  });
}
