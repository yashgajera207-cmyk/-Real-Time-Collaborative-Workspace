"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link2, ShieldCheck, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { DocumentAclTab, type DocumentAclEntry } from "./DocumentAclTab";
import { PublicLinksTab, type ShareLinkEntry } from "./PublicLinksTab";

export function ShareLinkPanel({ documentId, onClose }: { documentId: string; onClose: () => void }) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const currentUserEmail = session?.user?.email;

  const [tab, setTab] = useState<"access" | "links">("access");
  const [links, setLinks] = useState<ShareLinkEntry[]>([]);
  const [acls, setAcls] = useState<DocumentAclEntry[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);

  const isDocumentOwner = userRole === "owner";

  async function fetchDocumentDetails() {
    const res = await fetch(`/api/documents/${documentId}`);
    if (res.ok) {
      const data = await res.json();
      setUserRole(data.role);
    }
  }

  async function refreshLinks() {
    const res = await fetch(`/api/documents/${documentId}/share`);
    if (res.ok) setLinks(await res.json());
  }

  async function refreshAcls() {
    const res = await fetch(`/api/documents/${documentId}/acl`);
    if (res.ok) setAcls(await res.json());
  }

  useEffect(() => {
    void fetchDocumentDetails();
    void refreshLinks();
    void refreshAcls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  return (
    <motion.div
      initial={{ x: 340, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 340, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex h-full w-84 flex-col border-l border-ink-200/60 bg-white shadow-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 bg-ink-50/50">
        <div className="flex items-center gap-1.5 rounded-xl bg-ink-100/70 p-1 border border-ink-200/50">
          <button
            onClick={() => setTab("access")}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
              tab === "access"
                ? "bg-white text-ink-900 shadow-2xs"
                : "text-ink-500 hover:text-ink-900"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Document Access
          </button>
          <button
            onClick={() => setTab("links")}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
              tab === "links"
                ? "bg-white text-ink-900 shadow-2xs"
                : "text-ink-500 hover:text-ink-900"
            }`}
          >
            <Link2 className="h-3.5 w-3.5" />
            Public Links
          </button>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-800 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {tab === "access" ? (
        <DocumentAclTab
          documentId={documentId}
          isDocumentOwner={isDocumentOwner}
          acls={acls}
          currentUserId={currentUserId ?? undefined}
          currentUserEmail={currentUserEmail ?? undefined}
          refreshAcls={refreshAcls}
        />
      ) : (
        <PublicLinksTab documentId={documentId} links={links} refreshLinks={refreshLinks} />
      )}
    </motion.div>
  );
}
