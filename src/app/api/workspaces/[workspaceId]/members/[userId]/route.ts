import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DocumentRole } from "@prisma/client";

const updateRoleSchema = z.object({
  role: z.nativeEnum(DocumentRole),
});

// PATCH /api/workspaces/:workspaceId/members/:userId -> Update member role (owner only)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { workspaceId, userId } = await params;

  // Only workspace owner can manage members
  const requesterMembership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
  });

  if (!requesterMembership || requesterMembership.role !== "owner") {
    return NextResponse.json({ error: "Only the workspace owner can manage member roles" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid role" }, { status: 400 });
  }

  const newRole = parsed.data.role;

  // Prevent demoting owner if they are the sole owner of the workspace
  if (requesterMembership.userId === userId && newRole !== "owner") {
    const ownerCount = await prisma.membership.count({
      where: { workspaceId, role: "owner" },
    });
    if (ownerCount <= 1) {
      return NextResponse.json({ error: "Workspace must have at least one owner" }, { status: 400 });
    }
  }

  const updatedMembership = await prisma.membership.update({
    where: { userId_workspaceId: { userId, workspaceId } },
    data: { role: newRole },
  });

  // Update DocumentAcl for all workspace documents
  const docs = await prisma.document.findMany({
    where: { workspaceId },
    select: { id: true },
  });

  for (const doc of docs) {
    await prisma.documentAcl.upsert({
      where: { documentId_userId: { documentId: doc.id, userId } },
      create: { documentId: doc.id, userId, role: newRole },
      update: { role: newRole },
    });
  }

  return NextResponse.json(updatedMembership);
}

// DELETE /api/workspaces/:workspaceId/members/:userId -> Remove member from workspace (owner only)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { workspaceId, userId } = await params;

  // Only workspace owner can manage members
  const requesterMembership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
  });

  if (!requesterMembership || requesterMembership.role !== "owner") {
    return NextResponse.json({ error: "Only the workspace owner can remove members" }, { status: 403 });
  }

  // Prevent deleting owner if they are the sole owner of the workspace
  const targetMembership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });

  if (!targetMembership) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (targetMembership.role === "owner") {
    const ownerCount = await prisma.membership.count({
      where: { workspaceId, role: "owner" },
    });
    if (ownerCount <= 1) {
      return NextResponse.json({ error: "Cannot remove the only workspace owner" }, { status: 400 });
    }
  }

  // Delete membership and document ACLs
  await prisma.membership.delete({
    where: { userId_workspaceId: { userId, workspaceId } },
  });

  const docs = await prisma.document.findMany({
    where: { workspaceId },
    select: { id: true },
  });

  for (const doc of docs) {
    await prisma.documentAcl.deleteMany({
      where: { documentId: doc.id, userId },
    });
  }

  return NextResponse.json({ success: true });
}
