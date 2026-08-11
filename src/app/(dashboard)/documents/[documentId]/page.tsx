import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveDocumentRole, canRead } from "@/lib/permissions";
import { CollaborativeEditor } from "@/components/editor/CollaborativeEditor";

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

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-ink-100 bg-ink-50/60 px-6 py-3">
        <h1 className="truncate text-sm font-medium text-ink-900">{document.title}</h1>
      </header>
      <div className="flex-1 overflow-hidden">
        <CollaborativeEditor documentId={documentId} role={role!} />
      </div>
    </div>
  );
}
