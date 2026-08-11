import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewWorkspaceButton } from "@/components/workspace/NewWorkspaceButton";

export default async function WorkspacesPage() {
  const session = await auth();
  const userId = session!.user.id;

  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { workspace: { name: "asc" } },
  });

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-ink-900">Your workspaces</h1>
          <p className="text-sm text-ink-500">Pick a workspace, or start a new one.</p>
        </div>
        <NewWorkspaceButton />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {memberships.map((m: (typeof memberships)[number]) => (
          <Link
            key={m.workspace.id}
            href={`/workspaces/${m.workspace.id}`}
            className="rounded-xl border border-ink-100 bg-white p-5 transition-shadow hover:shadow-md"
          >
            <p className="font-medium text-ink-900">{m.workspace.name}</p>
            <p className="mt-1 text-xs text-ink-400">Your role: {m.role}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
