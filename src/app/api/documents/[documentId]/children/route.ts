import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canRead, resolveDocumentRole } from "@/lib/permissions";

// GET /api/documents/:documentId/children -> immediate child pages the
// current user can read, ordered for the sidebar tree.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { documentId } = await params;
  const role = await resolveDocumentRole(session.user.id, documentId);
  if (!canRead(role)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const children = await prisma.document.findMany({
    where: { parentId: documentId, acl: { some: { userId: session.user.id } } },
    orderBy: [{ position: "asc" }, { title: "asc" }],
    include: { acl: { where: { userId: session.user.id }, select: { role: true } } },
  });

  return NextResponse.json(
    children.map((c: (typeof children)[number]) => ({ id: c.id, title: c.title, role: c.acl[0]?.role }))
  );
}
