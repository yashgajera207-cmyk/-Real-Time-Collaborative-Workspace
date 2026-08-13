"use client";

import { useState } from "react";
import { UserPlus, Trash2, AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { DocumentRole } from "@prisma/client";

export interface DocumentAclEntry {
  id: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

const ROLE_BADGE_STYLE: Record<string, string> = {
  owner: "bg-purple-50 text-purple-700 border-purple-200",
  editor: "bg-indigo-50 text-indigo-700 border-indigo-200",
  commenter: "bg-amber-50 text-amber-700 border-amber-200",
  viewer: "bg-ink-100 text-ink-600 border-ink-200",
};

interface DocumentAclTabProps {
  documentId: string;
  isDocumentOwner: boolean;
  acls: DocumentAclEntry[];
  currentUserId?: string;
  currentUserEmail?: string;
  refreshAcls: () => Promise<void>;
}

export function DocumentAclTab({
  documentId,
  isDocumentOwner,
  acls,
  currentUserId,
  currentUserEmail,
  refreshAcls,
}: DocumentAclTabProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<DocumentRole>(DocumentRole.editor);
  const [granting, setGranting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [aclUserToRevoke, setAclUserToRevoke] = useState<{ id: string; name: string } | null>(null);

  async function handleGrantAccess(e: React.FormEvent) {
    e.preventDefault();
    if (!isDocumentOwner) return;

    setGranting(true);
    setError(null);
    setSuccessMsg(null);

    const res = await fetch(`/api/documents/${documentId}/acl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });

    setGranting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to grant document access");
      return;
    }

    const added = await res.json();
    setSuccessMsg(`Granted ${added.user.email} access as ${added.role}`);
    setInviteEmail("");
    await refreshAcls();
  }

  async function handleUpdateAclRole(userId: string, newRole: string) {
    if (!isDocumentOwner) return;

    setUpdatingUserId(userId);
    setError(null);

    const target = acls.find((a) => a.user.id === userId);
    if (!target) return;

    const res = await fetch(`/api/documents/${documentId}/acl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: target.user.email, role: newRole }),
    });

    setUpdatingUserId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update role");
      return;
    }

    await refreshAcls();
  }

  async function handleConfirmRevokeAcl() {
    if (!aclUserToRevoke || !isDocumentOwner) return;

    setUpdatingUserId(aclUserToRevoke.id);
    setError(null);

    const res = await fetch(`/api/documents/${documentId}/acl/${aclUserToRevoke.id}`, {
      method: "DELETE",
    });

    setUpdatingUserId(null);
    const targetName = aclUserToRevoke.name;
    setAclUserToRevoke(null);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to revoke access");
      return;
    }

    setSuccessMsg(`Revoked document access for ${targetName}`);
    await refreshAcls();
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {!isDocumentOwner && (
        <div className="m-3 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-xs font-semibold text-amber-800">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
          <span>Only the document owner can manage access permissions for this document.</span>
        </div>
      )}

      {isDocumentOwner && (
        <form onSubmit={handleGrantAccess} className="p-4 border-b border-ink-100 space-y-3 bg-white">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-800">
            <UserPlus className="h-4 w-4 text-indigo-600" />
            <span>Grant Direct Access</span>
          </div>

          <Input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="user.email@company.dev"
          />

          <div className="flex gap-2">
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as DocumentRole)}
              className="h-9 w-full rounded-xl border border-ink-200 bg-white px-3 text-xs font-semibold text-ink-900 outline-none focus:border-accent-500"
            >
              <option value={DocumentRole.owner}>Owner</option>
              <option value={DocumentRole.editor}>Editor</option>
              <option value={DocumentRole.commenter}>Commenter</option>
              <option value={DocumentRole.viewer}>Viewer</option>
            </select>
            <Button type="submit" loading={granting} className="h-9 px-4 text-xs font-semibold shrink-0">
              Grant
            </Button>
          </div>

          {error && (
            <p className="text-xs font-medium text-red-600 flex items-center gap-1 bg-red-50 p-2.5 rounded-xl border border-red-200">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" /> {error}
            </p>
          )}
          {successMsg && (
            <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> {successMsg}
            </p>
          )}
        </form>
      )}

      {/* ACL List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="flex items-center justify-between px-1 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Document Users</span>
          <span className="text-[11px] font-semibold text-ink-400">{acls.length} users</span>
        </div>

        {acls.map((acl) => {
          const isSelf =
            (currentUserId && acl.user.id === currentUserId) ||
            (currentUserEmail && acl.user.email?.toLowerCase() === currentUserEmail.toLowerCase());

          return (
            <div
              key={acl.id}
              className="flex items-center justify-between rounded-xl border border-ink-200/80 bg-white p-2.5 text-xs shadow-2xs gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Avatar name={acl.user.name} size={28} />
                <div className="min-w-0">
                  <p className="font-bold text-ink-900 truncate">{acl.user.name}</p>
                  <p className="text-[10px] text-ink-400 truncate">{acl.user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isSelf ? (
                  <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${ROLE_BADGE_STYLE[acl.role] ?? "bg-ink-100 text-ink-600"}`}>
                    {acl.role} (You)
                  </span>
                ) : isDocumentOwner ? (
                  <>
                    <select
                      value={acl.role}
                      disabled={updatingUserId === acl.user.id}
                      onChange={(e) => handleUpdateAclRole(acl.user.id, e.target.value)}
                      className="h-7 rounded-lg border border-ink-200 bg-ink-50/50 px-1.5 text-[11px] font-semibold text-ink-800 outline-none focus:border-accent-500"
                    >
                      <option value="owner">Owner</option>
                      <option value="editor">Editor</option>
                      <option value="commenter">Commenter</option>
                      <option value="viewer">Viewer</option>
                    </select>

                    <button
                      type="button"
                      disabled={updatingUserId === acl.user.id}
                      onClick={() => setAclUserToRevoke({ id: acl.user.id, name: acl.user.name })}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30"
                      title="Revoke access"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ROLE_BADGE_STYLE[acl.role] ?? "bg-ink-100 text-ink-600"}`}>
                    {acl.role}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmModal
        open={aclUserToRevoke !== null}
        onClose={() => setAclUserToRevoke(null)}
        onConfirm={handleConfirmRevokeAcl}
        loading={updatingUserId === aclUserToRevoke?.id}
        title={`Revoke access for ${aclUserToRevoke?.name ?? "User"}?`}
        description="Are you sure you want to revoke this user's explicit access to this document?"
        confirmText="Revoke Access"
      />
    </div>
  );
}
