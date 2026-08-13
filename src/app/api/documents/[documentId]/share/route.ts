import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireDocumentRole } from "@/lib/permissions";
import { DocumentRole } from "@prisma/client";

// GET  /api/documents/:documentId/share -> list this document's share links
// POST /api/documents/:documentId/share -> create one, optionally
//      password-protected. Read-only by construction - a share link
//      only ever grants viewer access (enforced again, independently,
//      in server/auth.ts when a socket actually connects with one).

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { documentId } = await params;
  try {
    await requireDocumentRole(session.user.id, documentId, DocumentRole.editor);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const links = await prisma.shareLink.findMany({
    where: { documentId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    links.map((l: (typeof links)[number]) => ({
      id: l.id,
      token: l.token,
      hasPassword: l.passwordHash !== null,
      revoked: l.revoked,
      createdAt: l.createdAt,
    }))
  );
}

const createSchema = z.object({ password: z.string().min(4).max(200).optional() });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { documentId } = await params;
  try {
    await requireDocumentRole(session.user.id, documentId, DocumentRole.editor);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const passwordHash = parsed.data.password ? await bcrypt.hash(parsed.data.password, 10) : null;

  const link = await prisma.shareLink.create({
    data: { documentId, createdById: session.user.id, passwordHash },
  });

  return NextResponse.json(
    { id: link.id, token: link.token, hasPassword: passwordHash !== null, revoked: false, createdAt: link.createdAt },
    { status: 201 }
  );
}
