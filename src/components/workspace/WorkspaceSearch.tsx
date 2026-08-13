"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Search, FileText } from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  snippet: string | null;
}

export function WorkspaceSearch({ workspaceId }: { workspaceId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/workspaces/${workspaceId}/search?q=${encodeURIComponent(query)}`);
      if (res.ok) setResults(await res.json());
    }, 200);
  }, [query, workspaceId]);

  return (
    <div className="relative px-3">
      <div className="flex items-center gap-2 rounded-xl border border-ink-200/80 bg-white/90 px-3 py-2 shadow-2xs transition-all focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-500/15">
        <Search className="h-3.5 w-3.5 text-ink-400 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search workspace..."
          className="w-full bg-transparent text-xs text-ink-900 outline-none placeholder:text-ink-400"
        />
        <kbd className="hidden sm:inline-flex h-4 items-center rounded border border-ink-200 bg-ink-100 px-1 text-[10px] font-mono text-ink-400">
          ⌘K
        </kbd>
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-3 right-3 z-30 mt-1.5 max-h-72 overflow-y-auto rounded-2xl border border-ink-200/80 bg-white/95 backdrop-blur-md shadow-xl p-1 space-y-0.5"
          >
            {results.map((r) => (
              <Link
                key={r.id}
                href={`/documents/${r.id}`}
                className="group flex items-start gap-2.5 rounded-xl px-3 py-2 text-xs transition-colors hover:bg-accent-50/70"
              >
                <FileText className="h-4 w-4 text-ink-400 group-hover:text-accent-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-900 group-hover:text-accent-700">{r.title}</p>
                  {r.snippet && <p className="mt-0.5 text-[11px] text-ink-500 line-clamp-1">{r.snippet}</p>}
                </div>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
