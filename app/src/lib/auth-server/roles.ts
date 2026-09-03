import type { Role } from "@prisma/client";

export function isStaff(role: Role): boolean {
  return role === "ADMIN" || role === "MODERATEUR";
}

export function isAdmin(role: Role): boolean {
  return role === "ADMIN";
}
