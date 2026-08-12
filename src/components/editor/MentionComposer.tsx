"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { WorkspaceMember } from "@/lib/use-workspace-members";
import { Button } from "@/components/ui/Button";

interface MentionComposerProps {
  members: WorkspaceMember[];
  placeholder?: string;
  submitLabel: string;
  onSubmit: (body: string, mentionedUserIds: string[]) => unknown;
  autoFocus?: boolean;
}

export function MentionComposer({
  members,
  placeholder = "Write a comment...",
  submitLabel,
  onSubmit,
  autoFocus,
}: MentionComposerProps) {
  const [value, setValue] = useState("");
  const [mentioned, setMentioned] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return members.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 5);
  }, [members, query]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    setValue(text);

    const cursor = e.target.selectionStart;
    const upToCursor = text.slice(0, cursor);
    const match = /(?:^|\s)@([a-zA-Z0-9 ]{0,24})$/.exec(upToCursor);
    setQuery(match ? match[1] ?? "" : null);
  }

  function insertMention(member: WorkspaceMember) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursor = textarea.selectionStart;
    const upToCursor = value.slice(0, cursor);
    const match = /(?:^|\s)@([a-zA-Z0-9 ]{0,24})$/.exec(upToCursor);
    if (!match) return;

    const startOfMention = cursor - match[0].length + (match[0].startsWith(" ") ? 1 : 0);
    const before = value.slice(0, startOfMention);
    const after = value.slice(cursor);
    const inserted = `@${member.name} `;
    const nextValue = `${before}${inserted}${after}`;

    setValue(nextValue);
    setMentioned((prev) => new Set(prev).add(member.id));
    setQuery(null);

    requestAnimationFrame(() => {
      textarea.focus();
      const pos = before.length + inserted.length;
      textarea.setSelectionRange(pos, pos);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setSubmitting(true);
    // Drop any mention whose @Name text got edited away.
    const stillPresent = [...mentioned].filter((id) => {
      const member = members.find((m) => m.id === id);
      return member && value.includes(`@${member.name}`);
    });
    await onSubmit(value.trim(), stillPresent);
    setSubmitting(false);
    setValue("");
    setMentioned(new Set());
  }

  return (
    <form onSubmit={handleSubmit} className="relative flex flex-col gap-2">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        autoFocus={autoFocus}
        placeholder={placeholder}
        rows={2}
        className="w-full resize-none rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none
          placeholder:text-ink-400 focus:border-accent-400 focus:shadow-[0_0_0_3px_rgba(55,138,221,0.15)]"
      />

      <AnimatePresence>
        {query !== null && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute left-2 top-full z-10 mt-1 w-48 overflow-hidden rounded-lg border border-ink-100 bg-white shadow-lg"
          >
            {suggestions.map((m) => (
              <button
                type="button"
                key={m.id}
                onClick={() => insertMention(m)}
                className="block w-full px-3 py-1.5 text-left text-sm text-ink-800 hover:bg-ink-50"
              >
                {m.name}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-end">
        <Button type="submit" loading={submitting} className="px-3 py-1.5 text-xs">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
