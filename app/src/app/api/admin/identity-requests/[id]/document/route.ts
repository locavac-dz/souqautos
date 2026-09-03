import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isStaff } from "@/lib/auth-server/roles";
import { identityDocumentAbsolutePath } from "@/lib/identity-uploads";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const identityRequest = await prisma.identityVerificationRequest.findUnique({ where: { id } });
  if (!identityRequest || !identityRequest.documentPath || !identityRequest.documentMime) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const buffer = await readFile(identityDocumentAbsolutePath(identityRequest.documentPath)).catch(() => null);
  if (!buffer) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": identityRequest.documentMime,
      "Content-Disposition": "inline",
      "Cache-Control": "no-store",
    },
  });
}
