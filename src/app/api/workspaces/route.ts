import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DocumentRole } from "@prisma/client";

// GET  /api/workspaces        -> workspaces the current user belongs to
// POST /api/workspaces        -> create a workspace (creator becomes owner)

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const memberships = await prisma.membership.findMany({
    where: { userId: session.user.id },
    include: { workspace: true },
    orderBy: { workspace: { name: "asc" } },
  });

  return NextResponse.json(
    memberships.map((m: (typeof memberships)[number]) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
    }))
  );
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "lowercase letters, numbers and hyphens only"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.workspace.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    return NextResponse.json({ error: "slug already taken" }, { status: 409 });
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      memberships: {
        create: { userId: session.user.id, role: DocumentRole.owner },
      },
    },
  });

  return NextResponse.json(workspace, { status: 201 });
}
