import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DocumentRole } from "@prisma/client";

// GET /api/workspaces/:workspaceId/members -> members list with workspace roles
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
    orderBy: { user: { name: "asc" } },
  });

  return NextResponse.json(
    memberships.map((m: (typeof memberships)[number]) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
    }))
  );
}

const addMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.nativeEnum(DocumentRole),
});

// POST /api/workspaces/:workspaceId/members -> Add workspace member by registered email (owner only)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { workspaceId } = await params;
  const requesterMembership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
  });

  // Strictly check that requester is workspace owner
  if (!requesterMembership || requesterMembership.role !== "owner") {
    return NextResponse.json({ error: "Only the workspace owner can add new workspace members" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = addMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { email, role } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  // Check if target user is registered in the database
  const targetUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!targetUser) {
    return NextResponse.json(
      { error: "User with this email is not registered. Ask them to sign up first." },
      { status: 404 }
    );
  }

  // Upsert workspace membership
  const membership = await prisma.membership.upsert({
    where: {
      userId_workspaceId: {
        userId: targetUser.id,
        workspaceId,
      },
    },
    create: {
      userId: targetUser.id,
      workspaceId,
      role,
    },
    update: {
      role,
    },
  });

  return NextResponse.json(
    {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      role: membership.role,
    },
    { status: 201 }
  );
}
