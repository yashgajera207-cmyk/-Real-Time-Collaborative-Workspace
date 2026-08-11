import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const memberships = await prisma.membership.findMany({
    where: { userId: session.user.id },
    include: { workspace: true },
    orderBy: { workspace: { name: "asc" } },
  });

  const workspaces = memberships.map((m: (typeof memberships)[number]) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    role: m.role,
  }));

  return (
    <div className="flex">
      <WorkspaceSidebar workspaces={workspaces} userName={session.user.name ?? session.user.email ?? ""} />
      <main className="min-h-screen flex-1">{children}</main>
    </div>
  );
}
