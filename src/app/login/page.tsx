import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/auth/LoginForm";
import { Sparkles, CheckCircle2, ShieldCheck, Zap, MessageSquare } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/workspaces");

  return (
    <div className="flex min-h-screen bg-ink-50 relative overflow-hidden subtle-dots-bg">
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/4 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-accent-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 translate-x-1/2 translate-y-1/2 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-screen p-4 sm:p-6 lg:p-8 items-center gap-8">
        {/* Left Side: Product Context & Visual Presence */}
        <div className="hidden lg:flex lg:col-span-7 flex-col justify-between h-full p-8 lg:p-12 space-y-12">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent-200 bg-accent-50/80 px-3.5 py-1 text-xs font-semibold text-accent-700 shadow-2xs">
              <Sparkles className="h-3.5 w-3.5 text-accent-600" />
              <span>Real-Time Collaborative Workspace</span>
            </div>

            <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-ink-900 leading-tight">
              Craft documents together with{" "}
              <span className="bg-gradient-to-r from-accent-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                zero sync latency.
              </span>
            </h1>

            <p className="text-base text-ink-600 leading-relaxed max-w-xl">
              Quill brings instant Yjs CRDT synchronization, anchored comment threads, version diffing, and fine-grained permissions to your entire team.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 text-sm font-semibold text-ink-800">
                <div className="h-6 w-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <span>Sub-10ms Yjs CRDT multiplayer synchronization</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold text-ink-800">
                <div className="h-6 w-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <span>Contextual inline comments anchored to document positions</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold text-ink-800">
                <div className="h-6 w-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <span>Role permissions and password-protected public sharing</span>
              </div>
            </div>
          </div>

          {/* Collaborative Presence Card Preview */}
          <div className="rounded-2xl border border-ink-200/80 bg-white/90 backdrop-blur-md p-6 shadow-lg space-y-4 max-w-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="text-xs font-bold text-ink-800">Live Active Room</span>
              </div>
              <div className="flex items-center -space-x-2">
                <Avatar name="Owen Owner" size={24} />
                <Avatar name="Edie Editor" size={24} />
                <Avatar name="Cam Commenter" size={24} />
              </div>
            </div>
            <p className="text-xs text-ink-600 italic border-l-2 border-accent-500 pl-3">
              "Tested up to 10k concurrent document rooms with durable per-update persistence."
            </p>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="lg:col-span-5 flex items-center justify-center w-full">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
