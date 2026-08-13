import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signShareWsToken } from "@/lib/ws-token";

// GET /api/share/:token -> public metadata only (title + whether a
// password is required). Never leaks document content and never checks
// a session - the whole point of a share link is that the visitor isn't
// a member of anything.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await prisma.shareLink.findUnique({
    where: { token },
    include: { document: { select: { title: true } } },
  });
  if (!link || link.revoked) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    title: link.document.title,
    passwordRequired: link.passwordHash !== null,
  });
}

const schema = z.object({ password: z.string().optional() });

// POST /api/share/:token -> verify the password (if any) and, on
// success, mint a viewer-only WS token scoped to this exact document.
// Re-called on every reconnect, same as the session-based token endpoint
// - the password isn't stored anywhere client-side between calls beyond
// what the person re-enters or the page keeps in memory for the tab's
// lifetime, and the token itself still expires in 60 seconds.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await prisma.shareLink.findUnique({ where: { token } });
  if (!link || link.revoked) return NextResponse.json({ error: "not found" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (link.passwordHash) {
    const provided = parsed.data.password;
    const valid = provided ? await bcrypt.compare(provided, link.passwordHash) : false;
    if (!valid) return NextResponse.json({ error: "incorrect password" }, { status: 403 });
  }

  const wsToken = signShareWsToken({ shareToken: token, documentId: link.documentId });
  return NextResponse.json({ wsToken, documentId: link.documentId });
}
