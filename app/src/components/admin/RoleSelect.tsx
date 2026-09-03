"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { Role } from "@prisma/client";

const ROLES: Role[] = ["PARTICULIER", "PROFESSIONNEL", "MODERATEUR", "ADMIN"];
const ROLE_KEY: Record<Role, string> = {
  PARTICULIER: "roleOptionParticulier",
  PROFESSIONNEL: "roleOptionProfessionnel",
  MODERATEUR: "roleOptionModerateur",
  ADMIN: "roleOptionAdmin",
};

export function RoleSelect({
  userId,
  currentRole,
  disabled,
}: {
  userId: string;
  currentRole: Role;
  disabled?: boolean;
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
      value={role}
      disabled={disabled || pending}
      onChange={(e) => handleChange(e.target.value as Role)}
      className="rounded-md border border-slate-300 px-2 py-1 text-sm bg-white disabled:opacity-50"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {t(ROLE_KEY[r])}
        </option>
      ))}
    </select>
  );
}
