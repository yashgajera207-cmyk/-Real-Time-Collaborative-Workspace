"use client";

import { useState } from "react";
import { Copy, Lock, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export interface ShareLinkEntry {
  id: string;
  token: string;
  hasPassword: boolean;
  revoked: boolean;
  createdAt: string;
}

interface PublicLinksTabProps {
  documentId: string;
  links: ShareLinkEntry[];
  refreshLinks: () => Promise<void>;
}

export function PublicLinksTab({ documentId, links, refreshLinks }: PublicLinksTabProps) {
  const [password, setPassword] = useState("");
  const [creatingLink, setCreatingLink] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function createLink() {
    setCreatingLink(true);
    await fetch(`/api/documents/${documentId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(password ? { password } : {}),
    });
    setCreatingLink(false);
    setPassword("");
    await refreshLinks();
  }

  async function revokeLink(linkId: string) {
    await fetch(`/api/documents/${documentId}/share/${linkId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revoked: true }),
    });
    await refreshLinks();
  }

  function shareUrl(token: string) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/share/${token}`;
  }

  async function copyLink(link: ShareLinkEntry) {
    await navigator.clipboard.writeText(shareUrl(link.token));
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-ink-100 p-4 bg-white">
        <Input
          label="Password Protection (optional)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Leave blank for open link"
        />
        <Button onClick={createLink} loading={creatingLink} className="w-full h-9 text-xs font-semibold shadow-xs">
          Create read-only share link
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {links.length === 0 && (
          <p className="p-4 text-center text-xs text-ink-400">No public share links generated yet.</p>
        )}
        {links.map((link) => (
          <div
            key={link.id}
            className={`rounded-2xl border p-3.5 space-y-2.5 transition-all ${
              link.revoked
                ? "opacity-50 bg-ink-50 border-ink-200"
                : "bg-white border-ink-200/80 shadow-2xs hover:border-accent-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-800">
                {link.hasPassword ? (
                  <span className="flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[10px]">
                    <Lock className="h-3 w-3" /> Password Protected
                  </span>
                ) : (
                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-[10px]">
                    Public Read Only
                  </span>
                )}
              </div>
              <span className="text-[10px] text-ink-400 font-mono">
                {new Date(link.createdAt).toLocaleDateString()}
              </span>
            </div>

            <p className="truncate text-xs font-mono text-ink-600 bg-ink-50 p-2 rounded-lg border border-ink-100">
              {shareUrl(link.token)}
            </p>

            <div className="flex items-center justify-between pt-1">
              {!link.revoked ? (
                <>
                  <button
                    onClick={() => copyLink(link)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-accent-600 hover:text-accent-800 transition-colors"
                  >
                    {copiedId === link.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" /> Copied link
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy share link
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => revokeLink(link.id)}
                    className="text-xs font-medium text-red-600 hover:text-red-800 transition-colors"
                  >
                    Revoke
                  </button>
                </>
              ) : (
                <span className="text-xs font-semibold text-ink-400">Link Revoked</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
