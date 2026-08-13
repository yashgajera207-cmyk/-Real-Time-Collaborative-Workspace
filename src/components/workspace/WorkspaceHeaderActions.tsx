"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { NewDocumentButton } from "@/components/workspace/NewDocumentButton";
import { WorkspaceSettingsModal } from "@/components/workspace/WorkspaceSettingsModal";
import { Settings, Users } from "lucide-react";

export function WorkspaceHeaderActions({
  workspaceId,
  workspaceName,
  role,
}: {
  workspaceId: string;
  workspaceName: string;
  role: string;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        onClick={() => setSettingsOpen(true)}
        className="h-10 text-xs font-semibold gap-1.5 shadow-2xs"
      >
        <Settings className="h-4 w-4 text-ink-600" />
        <span className="hidden sm:inline">Manage Workspace</span>
      </Button>

      <NewDocumentButton workspaceId={workspaceId} />

      <WorkspaceSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        workspaceId={workspaceId}
        currentName={workspaceName}
        currentRole={role}
      />
    </div>
  );
}
