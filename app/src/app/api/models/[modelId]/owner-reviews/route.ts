import { NextRequest, NextResponse, after } from "next/server";
import { notifyStaffOfPending } from "@/lib/staff-alerts";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { ownerReviewSchema } from "@/lib/validation/owner-review";
import { parsePositiveIntId } from "@/lib/validation/int-bounds";
import { checkCanWriteOwnerReview, editedByAuthorUpdate } from "@/lib/owner-review";
import { isUniqueViolation } from "@/lib/prisma-errors";

// Lot 116 — avis d'un propriétaire sur un modèle. Une seule ligne par personne
// et par modèle (contrainte d'unicité) : POST crée, PATCH modifie, DELETE retire
// SON avis. Un avis n'est public qu'après validation par l'équipe.
async function loadModel(rawId: string) {
  const modelId = parsePositiveIntId(rawId);
  if (modelId === null) return null;
  return prisma.model.findUnique({ where: { id: modelId }, select: { id: true } });
}

// Envois par personne et par jour, tentatives refusées comprises : assez large
// pour corriger un texte plusieurs fois, assez étroit pour freiner un envoi en série.
const DAILY_LIMIT = { limit: 20, windowMs: 24 * 60 * 60 * 1000 };

export async function POST(request: NextRequest, { params }: { params: Promise<{ modelId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`owner-review:${user.id}`, DAILY_LIMIT))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const eligibility = checkCanWriteOwnerReview({ emailVerified: Boolean(user.emailVerifiedAt) });
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.error }, { status: 403 });
  }

  const { modelId: rawModelId } = await params;
  const model = await loadModel(rawModelId);
  if (!model) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ownerReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues.map((i) => i.path.join(".")) }, { status: 400 });
  }

  try {
    const review = await prisma.ownerReview.create({
      data: {
        userId: user.id,
        modelId: model.id,
        rating: parsed.data.rating,
        comment: parsed.data.comment,
        purchaseYear: parsed.data.purchaseYear ?? null,
        mileageKm: parsed.data.mileageKm ?? null,
      },
      select: { id: true, status: true },
    });
    // Lot 118 — prévient l'équipe (après la réponse).
    after(() => notifyStaffOfPending("ownerReview"));
    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    // Un seul avis par personne et par modèle, même si deux envois partent en
    // même temps (double clic).
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "already_reviewed" }, { status: 409 });
    }
    throw error;
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ modelId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!(await checkRateLimit(`owner-review:${user.id}`, DAILY_LIMIT))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const eligibility = checkCanWriteOwnerReview({ emailVerified: Boolean(user.emailVerifiedAt) });
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.error }, { status: 403 });
  }

  const { modelId: rawModelId } = await params;
  const model = await loadModel(rawModelId);
  if (!model) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ownerReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues.map((i) => i.path.join(".")) }, { status: 400 });
  }

  const existing = await prisma.ownerReview.findUnique({
    where: { userId_modelId: { userId: user.id, modelId: model.id } },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Toute modification remet l'avis en attente de validation (voir
  // editedByAuthorUpdate), y compris un avis déjà publié.
  await prisma.ownerReview.update({
    where: { id: existing.id },
    data: {
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      purchaseYear: parsed.data.purchaseYear ?? null,
      mileageKm: parsed.data.mileageKm ?? null,
      ...editedByAuthorUpdate(),
    },
  });

  // Une modification remet l'avis en file : l'équipe en est prévenue aussi.
  after(() => notifyStaffOfPending("ownerReview"));

  return NextResponse.json({ ok: true, status: "EN_ATTENTE" });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ modelId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { modelId: rawModelId } = await params;
  const model = await loadModel(rawModelId);
  if (!model) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Les signalements qui visaient cet avis disparaissent avec lui (cascade).
  await prisma.ownerReview.deleteMany({ where: { userId: user.id, modelId: model.id } });
  return NextResponse.json({ ok: true });
}
