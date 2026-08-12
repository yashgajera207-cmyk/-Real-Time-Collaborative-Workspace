import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/workspaces/:workspaceId/members -> for the @mention picker.
// Membership alone doesn't grant document access (see permissions.ts),
// but it's the right pool of people to suggest mentioning - whether the
// mention resolves to something the recipient can act on is enforced
// separately, same as everything else here, by their own ACL row.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { workspaceId } = await params;
  const requesterMembership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
  });
  if (!requesterMembership) return NextResponse.json({ error: "not found" }, { status: 404 });

  const memberships = await prisma.membership.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json(memberships.map((m: (typeof memberships)[number]) => m.user));
}
