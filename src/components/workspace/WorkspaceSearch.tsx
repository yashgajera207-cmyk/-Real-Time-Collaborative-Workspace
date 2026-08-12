"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";

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
      <div className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white px-2.5 py-1.5">
        <Search className="h-3.5 w-3.5 text-ink-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search this workspace"
          className="w-full bg-transparent text-xs outline-none placeholder:text-ink-400"
        />
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute left-3 right-3 z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-ink-100 bg-white shadow-xl"
          >
            {results.map((r) => (
              <Link
                key={r.id}
                href={`/documents/${r.id}`}
                className="block border-b border-ink-50 px-3 py-2 text-xs last:border-0 hover:bg-ink-50"
              >
                <p className="font-medium text-ink-800">{r.title}</p>
                {r.snippet && <p className="mt-0.5 text-ink-400">{r.snippet}</p>}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
