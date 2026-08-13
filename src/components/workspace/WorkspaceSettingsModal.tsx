"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { ShieldAlert, AlertCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { WorkspaceRenameForm } from "./WorkspaceRenameForm";
import { WorkspaceMemberInviteForm } from "./WorkspaceMemberInviteForm";
import { WorkspaceMemberList, type MemberEntry } from "./WorkspaceMemberList";
import { WorkspaceDangerZone } from "./WorkspaceDangerZone";

export function WorkspaceSettingsModal({
  open,
  onClose,
  workspaceId,
  currentName,
  currentRole,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  currentName: string;
  currentRole: string;
}) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const currentUserEmail = session?.user?.email;

  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isOwner = currentRole === "owner";

  const fetchMembers = async () => {
    const res = await fetch(`/api/workspaces/${workspaceId}/members`);
    if (res.ok) setMembers(await res.json());
  };

  useEffect(() => {
    if (open) {
      setError(null);
      void fetchMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspaceId, currentName]);

  return (
    <Modal open={open} onClose={onClose} title="Workspace Settings & Members">
      <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
        {!isOwner && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs font-semibold text-amber-800">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
            <span>Only the workspace owner can rename the workspace, manage members, or delete the workspace.</span>
          </div>
        )}

        {error && (
          <p className="text-xs font-medium text-red-600 flex items-center gap-1 bg-red-50 p-2.5 rounded-xl border border-red-200">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" /> {error}
          </p>
        )}

        {/* Section 1: Workspace Name (Owner ONLY) */}
        {isOwner && (
          <WorkspaceRenameForm
            workspaceId={workspaceId}
            currentName={currentName}
            isOwner={isOwner}
            onError={setError}
          />
        )}

        {/* Section 2: Invite Member (Owner ONLY) */}
        {isOwner && (
          <WorkspaceMemberInviteForm
            workspaceId={workspaceId}
            isOwner={isOwner}
            onMembersUpdated={fetchMembers}
            onError={setError}
          />
        )}

        {/* Section 3: Members List */}
        <WorkspaceMemberList
          workspaceId={workspaceId}
          members={members}
          isOwner={isOwner}
          currentUserId={currentUserId ?? undefined}
          currentUserEmail={currentUserEmail ?? undefined}
          onMembersUpdated={fetchMembers}
          onError={setError}
        />

        {/* Section 4: Danger Zone - Delete Workspace (Owner ONLY) */}
        {isOwner && (
          <WorkspaceDangerZone
            workspaceId={workspaceId}
            workspaceName={currentName}
            isOwner={isOwner}
            onCloseModal={onClose}
            onError={setError}
          />
        )}
      </div>
    </Modal>
  );
}
