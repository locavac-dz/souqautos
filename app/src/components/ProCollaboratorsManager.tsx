"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type Permissions = { gererAnnonces: boolean; repondreAvis: boolean };
type Collaborator = { id: string; permissions: Permissions; name: string; email: string };

function summarizePermissions(permissions: Permissions, t: (key: string) => string): string {
  const active = [
    permissions.gererAnnonces && t("permGererAnnonces"),
    permissions.repondreAvis && t("permRepondreAvis"),
  ].filter(Boolean);
  return active.length > 0 ? active.join(", ") : t("permNone");
}

function PermissionCheckboxes({
  value,
  onChange,
}: {
  value: Permissions;
  onChange: (next: Permissions) => void;
}) {
  const t = useTranslations("Pro");
  return (
    <div className="flex flex-col gap-1 text-xs text-slate-600">
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={value.gererAnnonces}
          onChange={(e) => onChange({ ...value, gererAnnonces: e.target.checked })}
        />
        {t("permGererAnnonces")}
      </label>
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={value.repondreAvis}
          onChange={(e) => onChange({ ...value, repondreAvis: e.target.checked })}
        />
        {t("permRepondreAvis")}
      </label>
    </div>
  );
}

export function ProCollaboratorsManager({
  accountId,
  collaborators,
}: {
  accountId: string;
  collaborators: Collaborator[];
}) {
  const t = useTranslations("Pro");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [newPermissions, setNewPermissions] = useState<Permissions>({
    gererAnnonces: false,
    repondreAvis: false,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPermissions, setEditPermissions] = useState<Permissions>({
    gererAnnonces: false,
    repondreAvis: false,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const res = await fetch(`/api/pro/accounts/${accountId}/collaborators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), permissions: newPermissions }),
    });

    setPending(false);

    if (res.ok) {
      setEmail("");
      setNewPermissions({ gererAnnonces: false, repondreAvis: false });
      router.refresh();
      return;
    }

    const body = await res.json().catch(() => null);
    setError(
      body?.error === "user_not_found"
        ? t("collaboratorNotFound")
        : body?.error === "already_collaborator"
          ? t("alreadyCollaborator")
          : body?.error === "cannot_add_self"
            ? t("cannotAddSelf")
            : t("errorGeneric")
    );
  }

  async function handleSavePermissions(collaboratorId: string) {
    setPending(true);
    const res = await fetch(`/api/pro/accounts/${accountId}/collaborators/${collaboratorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: editPermissions }),
    });
    setPending(false);
    if (res.ok) {
      setEditingId(null);
      router.refresh();
    }
  }

  async function handleRemove(collaboratorId: string) {
    setPending(true);
    const res = await fetch(`/api/pro/accounts/${accountId}/collaborators/${collaboratorId}`, {
      method: "DELETE",
    });
    setPending(false);
    if (res.ok) {
      router.refresh();
    }
  }

  return (
    <div>
      <h2 className="text-lg font-medium text-slate-900 mb-3">{t("collaboratorsTitle")}</h2>
      {collaborators.length === 0 ? (
        <p className="text-sm text-slate-500 mb-4">{t("noCollaborators")}</p>
      ) : (
        <div className="space-y-2 mb-4">
          {collaborators.map((c) => (
            <div key={c.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-400">
                    {c.email} · {summarizePermissions(c.permissions, t)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (editingId === c.id) {
                        setEditingId(null);
                      } else {
                        setEditingId(c.id);
                        setEditPermissions(c.permissions);
                      }
                    }}
                    className="text-xs text-slate-500 hover:underline"
                  >
                    {t("editPermissions")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(c.id)}
                    disabled={pending}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    {t("removeCollaborator")}
                  </button>
                </div>
              </div>
              {editingId === c.id && (
                <div className="mt-2 flex items-center gap-4 border-t border-slate-100 pt-2">
                  <PermissionCheckboxes value={editPermissions} onChange={setEditPermissions} />
                  <button
                    type="button"
                    onClick={() => handleSavePermissions(c.id)}
                    disabled={pending}
                    className="text-xs rounded-md bg-slate-900 px-2 py-1 text-white disabled:opacity-50"
                  >
                    {t("savePermissions")}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="text-xs text-slate-500">{t("collaboratorEmailLabel")}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <div>
          <span className="text-xs text-slate-500">{t("collaboratorPermissionsLabel")}</span>
          <div className="mt-1">
            <PermissionCheckboxes value={newPermissions} onChange={setNewPermissions} />
          </div>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {t("addCollaborator")}
        </button>
      </form>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
