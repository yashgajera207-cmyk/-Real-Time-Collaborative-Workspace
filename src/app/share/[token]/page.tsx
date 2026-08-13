"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Lock, KeyRound, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PublicShareEditor } from "@/components/editor/PublicShareEditor";

interface Meta {
  title: string;
  passwordRequired: boolean;
}

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch(`/api/share/${token}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: Meta) => {
        setMeta(data);
        if (!data.passwordRequired) void unlock();
      })
      .catch(() => setNotFound(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function unlock(providedPassword?: string) {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/share/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: providedPassword }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("That password isn't right.");
      return;
    }
    const data = (await res.json()) as { documentId: string };
    setDocumentId(data.documentId);
    setUnlocked(true);
  }

  const getWsToken = useCallback(async () => {
    const res = await fetch(`/api/share/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: password || undefined }),
    });
    if (!res.ok) throw new Error("failed to obtain sync token");
    const data = (await res.json()) as { wsToken: string };
    return data.wsToken;
  }, [token, password]);

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 subtle-dots-bg">
        <div className="rounded-3xl border border-ink-200/80 bg-white p-8 text-center max-w-sm shadow-xl space-y-3">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-ink-900">Link Not Available</h2>
          <p className="text-xs text-ink-500 leading-relaxed">
            This share link doesn't exist, or has been revoked by its owner.
          </p>
        </div>
      </div>
    );
  }

  if (!meta) return null;

  if (unlocked && documentId) {
    return <PublicShareEditor documentId={documentId} title={meta.title} getWsToken={getWsToken} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 subtle-dots-bg">
      <div className="w-full max-w-md rounded-3xl border border-ink-200/80 bg-white/95 backdrop-blur-md p-8 sm:p-10 shadow-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-ink-900 line-clamp-1">{meta.title}</h1>
            <p className="text-xs text-ink-500">Password protected share link</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void unlock(password);
          }}
          className="flex flex-col gap-4"
        >
          <Input
            label="Enter Password"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          {error && (
            <p className="text-xs font-semibold text-red-500 bg-red-50 border border-red-200 rounded-xl p-2.5">
              {error}
            </p>
          )}
          <Button type="submit" loading={loading} className="w-full h-11 text-sm font-semibold shadow-md">
            Unlock Document
          </Button>
        </form>
      </div>
    </div>
  );
}
