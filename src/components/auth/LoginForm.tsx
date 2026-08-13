"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ArrowLeft, KeyRound, ShieldAlert, Sparkles, UserPlus, LogIn, CheckCircle2 } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  
  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // UI states
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        const result = await signIn("credentials", { email, password, redirect: false });
        setLoading(false);

        if (result?.error) {
          setError("Invalid email or password. Please check your credentials.");
          return;
        }

        router.push("/workspaces");
        router.refresh();
      } else {
        // Registration flow
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setLoading(false);
          setError(data.error ?? "Failed to create account.");
          return;
        }

        // Auto sign-in after registration
        setSuccessMsg("Account created! Signing you in...");
        const signInRes = await signIn("credentials", { email, password, redirect: false });
        setLoading(false);

        if (signInRes?.error) {
          setMode("signin");
          setError("Account created, but automatic sign in failed. Please sign in manually.");
          return;
        }

        router.push("/workspaces");
        router.refresh();
      }
    } catch (err) {
      setLoading(false);
      setError("Network error. Please make sure the server is running and try again.");
    }
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Brand Header */}
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-900 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-ink-900 text-white flex items-center justify-center font-bold text-sm shadow-xs">
            Q
          </div>
          <span className="font-extrabold text-base tracking-tight text-ink-900">Quill</span>
        </div>
      </div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-3xl border border-ink-200/80 bg-white/95 backdrop-blur-md p-8 shadow-xl space-y-6"
      >
        {/* Toggle Mode Segmented Control */}
        <div className="grid grid-cols-2 rounded-2xl bg-ink-100/70 p-1 border border-ink-200/50">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all ${
              mode === "signin"
                ? "bg-white text-ink-900 shadow-xs"
                : "text-ink-500 hover:text-ink-900"
            }`}
          >
            <LogIn className="h-3.5 w-3.5" />
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all ${
              mode === "signup"
                ? "bg-white text-ink-900 shadow-xs"
                : "text-ink-500 hover:text-ink-900"
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Create account
          </button>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">
            {mode === "signin" ? "Sign in to Quill" : "Create your Quill account"}
          </h1>
          <p className="text-sm text-ink-500 mt-1">
            {mode === "signin"
              ? "Access your real-time collaborative document workspace."
              : "Start collaborating with instant Yjs sync and anchored comments."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AnimatePresence mode="wait">
            {mode === "signup" && (
              <motion.div
                key="name-field"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Input
                  id="name"
                  label="Full Name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <Input
            id="email"
            label="Email address"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.dev"
          />

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-ink-600">
                Password
              </label>
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-xs font-semibold text-accent-600 hover:text-accent-800 transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs font-medium text-red-600 flex items-center gap-2"
              >
                <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </motion.div>
            )}
            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs font-semibold text-emerald-700 flex items-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <Button type="submit" loading={loading} className="mt-2 w-full h-11 text-sm font-semibold shadow-md">
            {mode === "signin" ? "Sign in to workspace" : "Create workspace account"}
          </Button>
        </form>
      </motion.div>

      {/* Forgot Password Modal */}
      <Modal open={forgotOpen} onClose={() => setForgotOpen(false)} title="Reset your password">
        <div className="space-y-4 text-xs leading-relaxed text-ink-600">
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-800 font-medium">
            <KeyRound className="h-4 w-4 shrink-0 text-amber-600" />
            <span>Password resets are managed securely via your workspace credentials.</span>
          </div>
          <p>
            If you need to update or reset your password, please contact your workspace owner or system administrator.
          </p>
          <Button variant="secondary" onClick={() => setForgotOpen(false)} className="w-full">
            Got it
          </Button>
        </div>
      </Modal>
    </div>
  );
}
