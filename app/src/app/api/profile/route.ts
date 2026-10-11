import { NextRequest, NextResponse } from "next/server";
import { apiHandler, requireUser, parseJsonBody } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { profileUpdateSchema } from "@/lib/validation/profile";
import { shouldResetPhoneVerification } from "@/lib/profile";
import { checkRateLimit } from "@/lib/rate-limit";
import { isUniqueViolation } from "@/lib/prisma-errors";

export const POST = apiHandler(async (request: NextRequest) => {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  if (!(await checkRateLimit(`update-profile:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await parseJsonBody(request, profileUpdateSchema);
  if (body instanceof NextResponse) return body;

  if (body.wilayaId) {
    const wilaya = await prisma.wilaya.findUnique({ where: { id: body.wilayaId } });
    if (!wilaya) {
      return NextResponse.json({ error: "validation" }, { status: 400 });
    }
  }

  const newPhone = body.phone?.trim() || null;
  if (newPhone && newPhone !== user.phone) {
    const existingPhone = await prisma.user.findUnique({ where: { phone: newPhone } });
    if (existingPhone && existingPhone.id !== user.id) {
      return NextResponse.json({ error: "phone_taken" }, { status: 409 });
    }
  }

  // Lot 119 — WhatsApp n'a de sens qu'avec un numéro ; sans numéro, l'option est désactivée.
  if (body.whatsappEnabled && !newPhone) {
    return NextResponse.json({ error: "whatsapp_needs_phone" }, { status: 400 });
  }
  const whatsappEnabled = newPhone ? body.whatsappEnabled : false;

  const resetPhoneVerification = shouldResetPhoneVerification({ oldPhone: user.phone, newPhone });

  try {
    await prisma.$transaction([
      prisma.profile.update({
        where: { userId: user.id },
        data: {
          displayName: body.displayName,
          wilayaId: body.wilayaId ?? null,
          bio: body.bio?.trim() || null,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          phone: newPhone,
          ...(whatsappEnabled !== undefined ? { whatsappEnabled } : {}),
          ...(resetPhoneVerification ? { phoneVerifiedAt: null } : {}),
        },
      }),
    ]);
  } catch (error) {
    // Le numéro a été pris par un autre compte entre la vérification et l'écriture ;
    // la transaction est annulée en entier (le profil n'est pas modifié non plus).
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "phone_taken" }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
});
