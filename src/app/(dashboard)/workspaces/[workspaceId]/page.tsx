import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DocumentList } from "@/components/workspace/DocumentList";
import { WorkspaceHeaderActions } from "@/components/workspace/WorkspaceHeaderActions";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { workspaceId } = await params;

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
    include: { workspace: true },
  });
  if (!membership) notFound();

  const documents = await prisma.document.findMany({
    where: { workspaceId, parentId: null, acl: { some: { userId: session.user.id } } },
    include: { acl: { where: { userId: session.user.id }, select: { role: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-6 sm:px-10 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ink-200/60 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink-900">
              {membership.workspace.name}
            </h1>
            <span className="rounded-full bg-accent-50 border border-accent-200 px-2.5 py-0.5 text-xs font-semibold text-accent-700 capitalize">
              {membership.role}
            </span>
          </div>
          <p className="text-sm text-ink-500 mt-1">
            {documents.length} top-level {documents.length === 1 ? "document" : "documents"} accessible to you
          </p>
        </div>
        <WorkspaceHeaderActions
          workspaceId={workspaceId}
          workspaceName={membership.workspace.name}
          role={membership.role}
        />
      </div>

      <DocumentList
        documents={documents.map((d: (typeof documents)[number]) => ({
          id: d.id,
          title: d.title,
          updatedAt: d.updatedAt.toISOString(),
          role: d.acl[0]!.role,
        }))}
      />
    </div>
  );
}
