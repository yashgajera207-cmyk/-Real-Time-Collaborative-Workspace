import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveDocumentRole, canRead } from "@/lib/permissions";
import { signWsToken } from "@/lib/ws-token";

// POST /api/documents/:documentId/token
// Issues the short-lived token the browser presents to the WS server.
// This route is the ONLY place the token is minted - it exists precisely
// so the WS server never has to trust anything the client claims about
// itself. The token proves "this is user X"; the WS server still
// re-resolves the ACL independently before letting the socket join.

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { documentId } = await params;
  const role = await resolveDocumentRole(session.user.id, documentId);
  if (!canRead(role)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const token = signWsToken({ sub: session.user.id, documentId });
  return NextResponse.json({ token, role });
}
