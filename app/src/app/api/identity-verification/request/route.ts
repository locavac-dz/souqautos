import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkCanSubmitIdentityRequest } from "@/lib/identity-verification";
import { saveIdentityDocument, DocumentValidationError } from "@/lib/identity-uploads";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!checkRateLimit(`identity-request:${user.id}`, { limit: 3, windowMs: 24 * 60 * 60 * 1000 })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const pendingRequest = await prisma.identityVerificationRequest.findFirst({
    where: { userId: user.id, status: "EN_ATTENTE" },
  });
  const eligibility = checkCanSubmitIdentityRequest({
    alreadyVerified: Boolean(user.identityVerifiedAt),
    hasPendingRequest: Boolean(pendingRequest),
  });
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.error }, { status: 400 });
  }

  const formData = await request.formData();
  const documentFile = formData.get("document");
  if (!(documentFile instanceof File) || documentFile.size === 0) {
    return NextResponse.json({ error: "document_required" }, { status: 400 });
  }

  let saved;
  try {
    saved = await saveIdentityDocument(documentFile);
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  try {
    await prisma.identityVerificationRequest.create({
      data: { userId: user.id, documentPath: saved.filename, documentMime: saved.mime },
    });
  } catch (error) {
    // Course concurrente (double-clic/retry réseau) sur l'index unique filtré
    // "un seul dossier EN_ATTENTE par utilisateur" (cf. audit sécurité) —
    // traité comme la même erreur que le contrôle findFirst ci-dessus,
    // jamais une 500 générique.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "request_pending" }, { status: 400 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
