"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { Editor, Range } from "@tiptap/react";
import type { LucideIcon } from "lucide-react";

export interface SlashMenuItem {
  title: string;
  icon: LucideIcon;
  command: (props: { editor: Editor; range: Range }) => void;
}

interface SlashMenuListProps {
  items: SlashMenuItem[];
  command: (item: SlashMenuItem) => void;
}

export interface SlashMenuListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const SlashMenuList = forwardRef<SlashMenuListRef, SlashMenuListProps>((props, ref) => {
  const [selected, setSelected] = useState(0);

  useEffect(() => setSelected(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowDown") {
        setSelected((prev) => (prev + 1) % props.items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setSelected((prev) => (prev - 1 + props.items.length) % props.items.length);
        return true;
      }
      if (event.key === "Enter") {
        const item = props.items[selected];
        if (item) props.command(item);
        return true;
      }
      return false;
    },
  }));

  if (props.items.length === 0) {
    return <div className="rounded-lg border border-ink-100 bg-white px-3 py-2 text-xs text-ink-400 shadow-lg">No matches</div>;
  }

  return (
    <div className="w-56 overflow-hidden rounded-lg border border-ink-100 bg-white py-1 shadow-xl">
      {props.items.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            key={item.title}
            onClick={() => props.command(item)}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
              index === selected ? "bg-ink-50 text-ink-900" : "text-ink-600"
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.title}
          </button>
        );
      })}
    </div>
  );
});
SlashMenuList.displayName = "SlashMenuList";
