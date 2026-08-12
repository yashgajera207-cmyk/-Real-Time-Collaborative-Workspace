import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DocumentList } from "@/components/workspace/DocumentList";
import { NewDocumentButton } from "@/components/workspace/NewDocumentButton";

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
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-ink-900">{membership.workspace.name}</h1>
          <p className="text-sm text-ink-500">{documents.length} document(s) you can access</p>
        </div>
        <NewDocumentButton workspaceId={workspaceId} />
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
