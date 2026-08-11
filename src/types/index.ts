import { DocumentRole } from "@prisma/client";

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role: DocumentRole;
}

export interface DocumentSummary {
  id: string;
  title: string;
  updatedAt: string;
  role: DocumentRole;
}

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "offline";

export { DocumentRole };
