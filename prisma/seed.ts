import { PrismaClient, DocumentRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Demo accounts covering every ACL level required in the handoff notes.
// Password for every account is "password123" (seed data only, not for prod).
const DEMO_USERS = [
  { name: "Owen Owner", email: "owner@quill.dev", role: DocumentRole.owner },
  { name: "Edie Editor", email: "editor@quill.dev", role: DocumentRole.editor },
  { name: "Cam Commenter", email: "commenter@quill.dev", role: DocumentRole.commenter },
  { name: "Vera Viewer", email: "viewer@quill.dev", role: DocumentRole.viewer },
];

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const workspace = await prisma.workspace.upsert({
    where: { slug: "demo" },
    update: {},
    create: { name: "Demo workspace", slug: "demo" },
  });

  const users = [];
  for (const u of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { name: u.name, email: u.email, passwordHash },
    });
    users.push({ ...u, user });

    await prisma.membership.upsert({
      where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
      update: { role: u.role },
      create: { userId: user.id, workspaceId: workspace.id, role: u.role },
    });
  }

  const owner = users.find((u) => u.role === DocumentRole.owner)!;

  const document = await prisma.document.upsert({
    where: { id: "seed-doc-quill-spec" },
    update: {},
    create: {
      id: "seed-doc-quill-spec",
      title: "Getting started with Quill",
      workspaceId: workspace.id,
      createdById: owner.user.id,
    },
  });

  for (const u of users) {
    await prisma.documentAcl.upsert({
      where: { documentId_userId: { documentId: document.id, userId: u.user.id } },
      update: { role: u.role },
      create: { documentId: document.id, userId: u.user.id, role: u.role },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
