import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveDocumentRole, canRead } from "@/lib/permissions";
import { CollaborativeEditor } from "@/components/editor/CollaborativeEditor";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/workspace/Breadcrumbs";

async function loadBreadcrumbs(startParentId: string | null): Promise<BreadcrumbItem[]> {
  const items: BreadcrumbItem[] = [];
  let cursor = startParentId;
  for (let i = 0; i < 20 && cursor; i++) {
    const ancestor: { id: string; title: string; parentId: string | null } | null =
      await prisma.document.findUnique({
        where: { id: cursor },
        select: { id: true, title: true, parentId: true },
      });
    if (!ancestor) break;
    items.unshift({ id: ancestor.id, title: ancestor.title });
    cursor = ancestor.parentId;
  }
  return items;
}

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { documentId } = await params;

  const role = await resolveDocumentRole(session.user.id, documentId);
  if (!canRead(role)) notFound();

  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) notFound();

  const breadcrumbs = await loadBreadcrumbs(document.parentId);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-ink-100 bg-ink-50/60 px-6 py-3">
        <Breadcrumbs items={breadcrumbs} current={document.title} />
      </header>
      <div className="flex-1 overflow-hidden">
        <CollaborativeEditor
          documentId={documentId}
          workspaceId={document.workspaceId}
          role={role!}
          userId={session.user.id}
          userName={session.user.name ?? session.user.email ?? "Anonymous"}
        />
      </div>
    </div>
  );
}
