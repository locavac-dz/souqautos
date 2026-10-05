"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { Role } from "@prisma/client";

const ROLES_BASE: Role[] = ["PARTICULIER", "PROFESSIONNEL", "MODERATEUR", "SUPPORT", "ADMIN"];
const ROLES_SUPER: Role[] = [...ROLES_BASE, "SUPER_ADMIN"];
const ROLE_KEY: Record<Role, string> = {
  PARTICULIER: "roleOptionParticulier",
  PROFESSIONNEL: "roleOptionProfessionnel",
  MODERATEUR: "roleOptionModerateur",
  SUPPORT: "roleOptionSupport",
  ADMIN: "roleOptionAdmin",
  SUPER_ADMIN: "roleOptionSuperAdmin",
};

export function RoleSelect({
  userId,
  currentRole,
  disabled,
  label,
  canAssignSuperAdmin = false,
}: {
  userId: string;
  currentRole: Role;
  disabled?: boolean;
  label: string; // nom accessible du menu (« Rôle de … ») : il y en a un par ligne, sans lui rien ne les distingue
  canAssignSuperAdmin?: boolean;
}) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [role, setRole] = useState(currentRole);
  const [pending, setPending] = useState(false);

  async function handleChange(newRole: Role) {
    setPending(true);
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    setPending(false);
    if (res.ok) {
      setRole(newRole);
      router.refresh();
    }
  }

  return (
    <select
      aria-label={label}
      value={role}
      disabled={disabled || pending}
      onChange={(e) => handleChange(e.target.value as Role)}
      className="rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1 text-sm bg-white dark:bg-slate-800 dark:text-slate-200 disabled:opacity-50"
    >
      {(canAssignSuperAdmin ? ROLES_SUPER : ROLES_BASE).map((r) => (
        <option key={r} value={r}>
          {t(ROLE_KEY[r])}
        </option>
      ))}
    </select>
  );
}
