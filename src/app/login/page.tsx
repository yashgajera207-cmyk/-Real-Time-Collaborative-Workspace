import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/workspaces");

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <LoginForm />
    </div>
  );
}
