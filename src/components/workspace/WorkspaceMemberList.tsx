"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

export interface MemberEntry {
  id: string;
  name: string;
  email: string;
  role: string;
}

const ROLE_BADGE_STYLE: Record<string, string> = {
  owner: "bg-purple-50 text-purple-700 border-purple-200",
  editor: "bg-indigo-50 text-indigo-700 border-indigo-200",
  commenter: "bg-amber-50 text-amber-700 border-amber-200",
  viewer: "bg-ink-100 text-ink-600 border-ink-200",
};

interface WorkspaceMemberListProps {
  workspaceId: string;
  members: MemberEntry[];
  isOwner: boolean;
  currentUserId?: string;
  currentUserEmail?: string;
  onMembersUpdated: () => Promise<void>;
  onError: (msg: string | null) => void;
}

export function WorkspaceMemberList({
  workspaceId,
  members,
  isOwner,
  currentUserId,
  currentUserEmail,
  onMembersUpdated,
  onError,
}: WorkspaceMemberListProps) {
  const router = useRouter();
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<MemberEntry | null>(null);

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (!isOwner) return;

    setUpdatingMemberId(userId);
    onError(null);

    const member = members.find((m) => m.id === userId);
    if (!member) return;

    const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: member.email, role: newRole }),
    });

    setUpdatingMemberId(null);
    if (res.ok) {
      await onMembersUpdated();
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      onError(data.error ?? "Failed to update member role");
    }
  };

  const handleConfirmDeleteMember = async () => {
    if (!memberToDelete || !isOwner) return;
    setUpdatingMemberId(memberToDelete.id);
    onError(null);

    const res = await fetch(`/api/workspaces/${workspaceId}/members/${memberToDelete.id}`, {
      method: "DELETE",
    });

    setUpdatingMemberId(null);
    setMemberToDelete(null);
    if (res.ok) {
      await onMembersUpdated();
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      onError(data.error ?? "Failed to remove member");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-800">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Workspace Members ({members.length})</span>
        </div>
      </div>

      <div className="space-y-2">
        {members.map((m) => {
          const isSelf =
            (currentUserId && m.id === currentUserId) ||
            (currentUserEmail && m.email?.toLowerCase() === currentUserEmail.toLowerCase());

          return (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-xl border border-ink-200/80 bg-white p-3 text-xs shadow-2xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar name={m.name} size={30} />
                <div className="min-w-0">
                  <p className="font-bold text-ink-900 truncate">{m.name}</p>
                  <p className="text-[11px] text-ink-400 truncate">{m.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isSelf ? (
                  <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${ROLE_BADGE_STYLE[m.role] ?? "bg-ink-100 text-ink-600"}`}>
                    {m.role} (You)
                  </span>
                ) : isOwner ? (
                  <>
                    <select
                      value={m.role}
                      disabled={updatingMemberId === m.id}
                      onChange={(e) => handleUpdateRole(m.id, e.target.value)}
                      className="h-8 rounded-lg border border-ink-200 bg-ink-50/50 px-2 text-xs font-semibold text-ink-800 outline-none focus:border-accent-500"
                    >
                      <option value="owner">Owner</option>
                      <option value="editor">Editor</option>
                      <option value="commenter">Commenter</option>
                      <option value="viewer">Viewer</option>
                    </select>

                    <button
                      type="button"
                      disabled={updatingMemberId === m.id}
                      onClick={() => setMemberToDelete(m)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30"
                      title="Remove member"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ROLE_BADGE_STYLE[m.role] ?? "bg-ink-100 text-ink-600"}`}>
                    {m.role}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmModal
        open={memberToDelete !== null}
        onClose={() => setMemberToDelete(null)}
        onConfirm={handleConfirmDeleteMember}
        loading={updatingMemberId === memberToDelete?.id}
        title={`Remove ${memberToDelete?.name ?? "Member"}?`}
        description={`Are you sure you want to remove ${memberToDelete?.email} from this workspace?`}
        confirmText="Remove Member"
      />
    </div>
  );
}
