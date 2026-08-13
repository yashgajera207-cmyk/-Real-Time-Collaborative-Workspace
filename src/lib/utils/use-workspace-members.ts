"use client";

import { useEffect, useState } from "react";

export interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
}

export function useWorkspaceMembers(workspaceId: string | null) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    void fetch(`/api/workspaces/${workspaceId}/members`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setMembers(data);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return members;
}
