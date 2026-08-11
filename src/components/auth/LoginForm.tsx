"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const DEMO_ACCOUNTS = [
  { role: "owner", email: "owner@quill.dev" },
  { role: "editor", email: "editor@quill.dev" },
  { role: "commenter", email: "commenter@quill.dev" },
  { role: "viewer", email: "viewer@quill.dev" },
];

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (result?.error) {
      setError("Those credentials didn't match an account.");
      return;
    }
    router.push("/workspaces");
    router.refresh();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-sm rounded-2xl border border-ink-100 bg-white p-8 shadow-sm"
    >
      <h1 className="mb-1 text-xl font-medium text-ink-900">Sign in to Quill</h1>
      <p className="mb-6 text-sm text-ink-500">A real-time collaborative workspace.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="owner@quill.dev"
        />
        <Input
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="text-sm text-red-600"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <Button type="submit" loading={loading} className="mt-1 w-full">
          Sign in
        </Button>
      </form>

      <div className="mt-6 border-t border-ink-100 pt-4">
        <p className="mb-2 text-xs font-medium text-ink-400">Demo accounts (password123)</p>
        <div className="flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              onClick={() => {
                setEmail(acc.email);
                setPassword("password123");
              }}
              className="rounded-full border border-ink-100 px-2.5 py-1 text-xs text-ink-600 hover:border-ink-300"
            >
              {acc.role}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
