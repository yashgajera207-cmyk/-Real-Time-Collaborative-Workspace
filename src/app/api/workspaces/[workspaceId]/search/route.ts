import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildSnippet } from "@/lib/search-snippet";

// GET /api/workspaces/:workspaceId/search?q=...
// The `acl: { some: { userId } }` clause is load-bearing: it's what
// keeps a document the searcher can't read from ever appearing in
// results, rather than relying on the UI to hide it after the fact.
export async function GET(req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { workspaceId } = await params;
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  const documents = await prisma.document.findMany({
    where: {
      workspaceId,
      acl: { some: { userId: session.user.id } },
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { searchText: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 20,
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true, searchText: true },
  });

  return NextResponse.json(
    documents.map((d: (typeof documents)[number]) => ({
      id: d.id,
      title: d.title,
      updatedAt: d.updatedAt,
      snippet: buildSnippet(d.searchText, q),
    }))
  );
}
