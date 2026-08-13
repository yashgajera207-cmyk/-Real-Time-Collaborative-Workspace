import { auth } from "@/lib/auth";
import { LandingPage } from "@/components/landing/LandingPage";

export default async function RootPage() {
  const session = await auth();
  return <LandingPage isLoggedIn={!!session?.user} />;
}
