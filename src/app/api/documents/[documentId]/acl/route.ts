import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveDocumentRole, canRead } from "@/lib/permissions";
import { DocumentRole } from "@prisma/client";

// GET /api/documents/:documentId/acl -> list explicit document ACL entries
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { documentId } = await params;
  const userRole = await resolveDocumentRole(session.user.id, documentId);
  if (!canRead(userRole)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const acls = await prisma.documentAcl.findMany({
    where: { documentId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    acls.map((a: (typeof acls)[number]) => ({
      id: a.id,
      role: a.role,
      user: a.user,
    }))
  );
}

const aclSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.nativeEnum(DocumentRole),
});

// POST /api/documents/:documentId/acl -> grant/update document-level access (Document Owner ONLY)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { documentId } = await params;
  const userRole = await resolveDocumentRole(session.user.id, documentId);

  // Strictly enforce Document Owner permission
  if (userRole !== DocumentRole.owner) {
    return NextResponse.json({ error: "Only the document owner can grant or modify document access" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = aclSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { email, role } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  // Find user by email (must be registered user)
  const targetUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!targetUser) {
    return NextResponse.json(
      { error: "User with this email is not registered. Ask them to sign up first." },
      { status: 404 }
    );
  }

  // Prevent self demotion
  if (targetUser.id === session.user.id && role !== DocumentRole.owner) {
    return NextResponse.json({ error: "You cannot demote your own owner role" }, { status: 400 });
  }

  // Upsert DocumentAcl row
  const acl = await prisma.documentAcl.upsert({
    where: {
      documentId_userId: {
        documentId,
        userId: targetUser.id,
      },
    },
    create: {
      documentId,
      userId: targetUser.id,
      role,
    },
    update: {
      role,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(
    {
      id: acl.id,
      role: acl.role,
      user: acl.user,
    },
    { status: 201 }
  );
}
