"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  id: string;
  title: string;
}

export function Breadcrumbs({ items, current }: { items: BreadcrumbItem[]; current: string }) {
  if (items.length === 0) return <span className="truncate text-sm font-medium text-ink-900">{current}</span>;

  return (
    <div className="flex min-w-0 items-center gap-1 text-sm">
      {items.map((item) => (
        <span key={item.id} className="flex items-center gap-1 text-ink-400">
          <Link href={`/documents/${item.id}`} className="max-w-[10rem] truncate hover:text-ink-700">
            {item.title}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        </span>
      ))}
      <span className="truncate font-medium text-ink-900">{current}</span>
    </div>
  );
}
