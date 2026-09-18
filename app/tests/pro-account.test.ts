import { describe, expect, it } from "vitest";
import {
  canManageCollaborators,
  canManageProListings,
  canReplyToProReviews,
  canViewProDashboard,
  shouldRevokeVerifiedBadge,
} from "@/lib/pro-account";

const bothPermissions = { gererAnnonces: true, repondreAvis: true };
const noPermissions = { gererAnnonces: false, repondreAvis: false };
const onlyListings = { gererAnnonces: true, repondreAvis: false };
const onlyReviews = { gererAnnonces: false, repondreAvis: true };

describe("canViewProDashboard", () => {
  it("allows the owner", () => {
    expect(canViewProDashboard({ isOwner: true, permissions: null })).toBe(true);
  });

  it("allows a collaborator with no permissions activated at all", () => {
    expect(canViewProDashboard({ isOwner: false, permissions: noPermissions })).toBe(true);
  });

  it("blocks a stranger (not a collaborator at all)", () => {
    expect(canViewProDashboard({ isOwner: false, permissions: null })).toBe(false);
  });
});

describe("canManageProListings", () => {
  it("allows the owner", () => {
    expect(canManageProListings({ isOwner: true, permissions: null })).toBe(true);
  });

  it("allows a collaborator with gererAnnonces activated", () => {
    expect(canManageProListings({ isOwner: false, permissions: onlyListings })).toBe(true);
    expect(canManageProListings({ isOwner: false, permissions: bothPermissions })).toBe(true);
  });

  it("blocks a collaborator without gererAnnonces, even with repondreAvis", () => {
    expect(canManageProListings({ isOwner: false, permissions: onlyReviews })).toBe(false);
    expect(canManageProListings({ isOwner: false, permissions: noPermissions })).toBe(false);
  });

  it("blocks a stranger", () => {
    expect(canManageProListings({ isOwner: false, permissions: null })).toBe(false);
  });
});

describe("canReplyToProReviews", () => {
  it("allows the owner", () => {
    expect(canReplyToProReviews({ isOwner: true, permissions: null })).toBe(true);
  });

  it("allows a collaborator with repondreAvis activated", () => {
    expect(canReplyToProReviews({ isOwner: false, permissions: onlyReviews })).toBe(true);
    expect(canReplyToProReviews({ isOwner: false, permissions: bothPermissions })).toBe(true);
  });

  it("blocks a collaborator without repondreAvis, even with gererAnnonces", () => {
    expect(canReplyToProReviews({ isOwner: false, permissions: onlyListings })).toBe(false);
    expect(canReplyToProReviews({ isOwner: false, permissions: noPermissions })).toBe(false);
  });

  it("blocks a stranger", () => {
    expect(canReplyToProReviews({ isOwner: false, permissions: null })).toBe(false);
  });
});

describe("canManageCollaborators", () => {
  it("allows only the owner", () => {
    expect(canManageCollaborators({ isOwner: true, permissions: null })).toBe(true);
  });

  it("blocks a collaborator with every permission activated — never delegable", () => {
    expect(canManageCollaborators({ isOwner: false, permissions: bothPermissions })).toBe(false);
  });

  it("blocks a stranger", () => {
    expect(canManageCollaborators({ isOwner: false, permissions: null })).toBe(false);
  });
});

describe("shouldRevokeVerifiedBadge", () => {
  const verified = { badgeVerifie: true, currentName: "Auto Sara Motors" };

  it("revokes the badge when a verified account really changes its business name", () => {
    expect(shouldRevokeVerifiedBadge({ ...verified, nextName: "Garage Central" })).toBe(true);
  });

  it("keeps the badge when only case or spacing changes", () => {
    expect(shouldRevokeVerifiedBadge({ ...verified, nextName: "  auto   sara motors " })).toBe(false);
  });

  it("keeps the badge when the name is unchanged", () => {
    expect(shouldRevokeVerifiedBadge({ ...verified, nextName: "Auto Sara Motors" })).toBe(false);
  });

  it("has nothing to revoke on an account that is not verified", () => {
    expect(shouldRevokeVerifiedBadge({ badgeVerifie: false, currentName: "A", nextName: "B" })).toBe(false);
  });
});
