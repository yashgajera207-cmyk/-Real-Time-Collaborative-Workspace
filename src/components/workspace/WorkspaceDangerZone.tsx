"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface WorkspaceDangerZoneProps {
  workspaceId: string;
  workspaceName: string;
  isOwner: boolean;
  onCloseModal: () => void;
  onError: (msg: string | null) => void;
}

export function WorkspaceDangerZone({
  workspaceId,
  workspaceName,
  isOwner,
  onCloseModal,
  onError,
}: WorkspaceDangerZoneProps) {
  const router = useRouter();
  const [showDeleteWsModal, setShowDeleteWsModal] = useState(false);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);

  const handleDeleteWorkspace = async () => {
    if (!isOwner || deletingWorkspace) return;
    setDeletingWorkspace(true);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, { method: "DELETE" });
      if (res.ok) {
        setShowDeleteWsModal(false);
        onCloseModal();
        router.push("/");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        onError(data.error ?? "Failed to delete workspace");
      }
    } finally {
      setDeletingWorkspace(false);
    }
  };

  if (!isOwner) return null;

  return (
    <>
      <div className="p-4 rounded-2xl border border-red-200 bg-red-50/40 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-800">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <span>Delete Workspace</span>
        </div>
        <p className="text-xs text-red-700 leading-relaxed">
          Permanently delete this workspace and all associated documents, pages, and member permissions.
        </p>
        <Button
          type="button"
          onClick={() => setShowDeleteWsModal(true)}
          className="h-9 px-4 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-xs"
        >
          Delete Workspace
        </Button>
      </div>

      <ConfirmModal
        open={showDeleteWsModal}
        onClose={() => setShowDeleteWsModal(false)}
        onConfirm={handleDeleteWorkspace}
        loading={deletingWorkspace}
        title={`Delete "${workspaceName}"?`}
        description="Are you sure you want to delete this workspace? All documents, pages, and member permissions inside will be permanently removed. This action cannot be undone."
        confirmText="Delete Workspace"
      />
    </>
  );
}
