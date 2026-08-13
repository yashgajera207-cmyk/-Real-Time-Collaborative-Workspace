"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, CheckCircle2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { DocumentRole } from "@prisma/client";

interface WorkspaceMemberInviteFormProps {
  workspaceId: string;
  isOwner: boolean;
  onMembersUpdated: () => Promise<void>;
  onError: (msg: string | null) => void;
}

export function WorkspaceMemberInviteForm({
  workspaceId,
  isOwner,
  onMembersUpdated,
  onError,
}: WorkspaceMemberInviteFormProps) {
  const router = useRouter();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<DocumentRole>(DocumentRole.editor);
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;

    setInviting(true);
    onError(null);
    setInviteSuccess(null);

    const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });

    setInviting(false);
    if (res.ok) {
      const added = await res.json();
      setInviteSuccess(`Added ${added.email} as ${added.role}`);
      setInviteEmail("");
      await onMembersUpdated();
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      onError(data.error ?? "Failed to add member to workspace");
    }
  };

  return (
    <form onSubmit={handleAddMember} className="space-y-3 p-4 rounded-2xl border border-ink-100 bg-ink-50/40">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-800">
        <UserPlus className="h-4 w-4 text-indigo-600" />
        <span>Add Workspace Member</span>
      </div>
      <p className="text-xs text-ink-500">Enter a registered user's email address to add them to this workspace.</p>

      <Input
        type="email"
        required
        value={inviteEmail}
        onChange={(e) => setInviteEmail(e.target.value)}
        placeholder="registered.user@company.dev"
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
        <Button type="submit" loading={inviting} className="h-9 px-4 text-xs font-semibold shrink-0">
          Add Member
        </Button>
      </div>

      {inviteSuccess && (
        <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> {inviteSuccess}
        </p>
      )}
    </form>
  );
}
