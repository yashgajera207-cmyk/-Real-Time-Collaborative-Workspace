import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewWorkspaceButton } from "@/components/workspace/NewWorkspaceButton";
import { LayoutGrid, ArrowRight, ShieldCheck } from "lucide-react";

export default async function WorkspacesPage() {
  const session = await auth();
  const userId = session!.user.id;

  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { workspace: { name: "asc" } },
  });

  return (
    <div className="mx-auto max-w-5xl px-6 sm:px-10 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ink-200/60 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink-900">Your Workspaces</h1>
          <p className="text-sm text-ink-500 mt-1">Select an active workspace, or spin up a new collaborative environment.</p>
        </div>
        <NewWorkspaceButton />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {memberships.map((m: (typeof memberships)[number]) => (
          <Link
            key={m.workspace.id}
            href={`/workspaces/${m.workspace.id}`}
            className="group flex flex-col justify-between h-40 rounded-2xl border border-ink-200/80 bg-white p-6 shadow-2xs hover:shadow-card-hover hover:border-accent-400 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center group-hover:bg-accent-600 group-hover:text-white transition-colors">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-600">
                {m.role}
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-ink-900 group-hover:text-accent-600 transition-colors">
                  {m.workspace.name}
                </h3>
                <ArrowRight className="h-4 w-4 text-ink-400 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </div>
              <p className="mt-1 text-xs text-ink-400">Slug: {m.workspace.slug}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
