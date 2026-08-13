"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Zap,
  MessageSquare,
  History,
  FolderTree,
  Search,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Lock,
  Layers,
  ChevronRight,
  Globe,
  Star,
  Users,
  Code,
  FileText,
  Clock,
} from "lucide-react";
import { HeroEditorMockup } from "./HeroEditorMockup";
import { Button } from "@/components/ui/Button";

export function LandingPage({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const features = [
    {
      icon: Zap,
      color: "text-amber-500 bg-amber-50 border-amber-200",
      title: "Instant Yjs Multiplayer Sync",
      description:
        "Sub-10ms CRDT conflict-free synchronization powered by WebSockets. Every stroke and cursor is visible instantly across all active clients.",
    },
    {
      icon: MessageSquare,
      color: "text-indigo-600 bg-indigo-50 border-indigo-200",
      title: "Anchored Comments & Mentions",
      description:
        "Contextual comment threads bound to precise text selections. Tag teammates with @mentions and track real-time resolution states.",
    },
    {
      icon: History,
      color: "text-emerald-600 bg-emerald-50 border-emerald-200",
      title: "Visual Version History & Diffs",
      description:
        "Automatic snapshot creation with word-by-word diffing. Compare changes over time and restore prior document states with one click.",
    },
    {
      icon: FolderTree,
      color: "text-sky-600 bg-sky-50 border-sky-200",
      title: "Infinite Page Nesting",
      description:
        "Organize your workspace hierarchy effortlessly with nested subpages, dynamic breadcrumb paths, and intuitive sidebar navigation.",
    },
    {
      icon: Search,
      color: "text-purple-600 bg-purple-50 border-purple-200",
      title: "Instant Workspace Search",
      description:
        "Locate documents instantly with fuzzy title and content search across your entire workspace, complete with match snippet highlights.",
    },
    {
      icon: ShieldCheck,
      color: "text-rose-600 bg-rose-50 border-rose-200",
      title: "Granular ACL & Share Links",
      description:
        "Control exact permissions per user (Owner, Editor, Commenter, Viewer) or generate password-protected public share links.",
    },
  ];

  const steps = [
    {
      step: "01",
      title: "Create & Structure",
      description:
        "Draft rich-text documents with block formatting, code blocks, task lists, and infinitely nested child pages.",
      icon: FileText,
    },
    {
      step: "02",
      title: "Invite & Edit Live",
      description:
        "Collaborate in real time with teammate presence indicators, live caret position labels, and instant WebSocket updates.",
      icon: Users,
    },
    {
      step: "03",
      title: "Review & Publish",
      description:
        "Review inline comment threads, diff automatic snapshots, and share password-protected public links securely.",
      icon: CheckCircle2,
    },
  ];

  const testimonials = [
    {
      quote:
        "Quill replaced three separate tools for our product team. The real-time sync speed and inline comment anchoring are unmatched.",
      author: "Alex Morgan",
      role: "VP of Engineering at CloudScale",
      avatar: "Alex Morgan",
    },
    {
      quote:
        "The version history and snapshot diffing saved us during a major API spec revision. Knowing every update is persisted instantly gives us complete confidence.",
      author: "Sarah Chen",
      role: "Lead Product Architect at DevLab",
      avatar: "Sarah Chen",
    },
    {
      quote:
        "We set up password-protected share links for external client reviews in under 10 seconds. Elegant, fast, and remarkably robust.",
      author: "Marcus Vance",
      role: "Design Director at Acme Systems",
      avatar: "Marcus Vance",
    },
  ];

  return (
    <div className="min-h-screen bg-ink-50 text-ink-900 overflow-x-hidden selection:bg-accent-100 selection:text-accent-900">
      {/* Navigation Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-white/85 backdrop-blur-md border-b border-ink-200/60 shadow-xs py-3.5" : "bg-transparent py-5"
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-xl bg-ink-900 text-white flex items-center justify-center font-bold text-lg shadow-sm group-hover:scale-105 transition-transform">
              Q
            </div>
            <span className="font-bold text-xl tracking-tight text-ink-900">Quill</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-ink-600">
            <a href="#features" className="hover:text-ink-900 transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-ink-900 transition-colors">
              How it works
            </a>
            <a href="#testimonials" className="hover:text-ink-900 transition-colors">
              Testimonials
            </a>
            <a href="#faq" className="hover:text-ink-900 transition-colors">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Link href="/workspaces">
                <Button variant="primary" className="shadow-sm">
                  Go to App
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" className="text-sm">
                    Sign in
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="primary" className="shadow-sm">
                    Get started
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 rounded-full border border-accent-200 bg-accent-50/80 px-3.5 py-1 text-xs font-semibold text-accent-700 shadow-2xs"
          >
            <Sparkles className="h-3.5 w-3.5 text-accent-600" />
            <span>Real-Time Collaborative Workspace</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-ink-900 leading-[1.12]"
          >
            Where teams write, think, and build together —{" "}
            <span className="bg-gradient-to-r from-accent-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              in real time.
            </span>
          </motion.h1>

          {/* Subhead */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg sm:text-xl text-ink-600 max-w-2xl mx-auto leading-relaxed"
          >
            Quill combines instant Yjs multiplayer sync, anchored comment threads, visual version history, and nested documents into one fast, elegant workspace.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2"
          >
            <Link href={isLoggedIn ? "/workspaces" : "/login"}>
              <Button variant="primary" className="h-12 px-7 text-base font-semibold shadow-md hover:shadow-lg">
                {isLoggedIn ? "Open your workspaces" : "Get started for free"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button variant="secondary" className="h-12 px-6 text-base font-semibold">
                Explore features
              </Button>
            </a>
          </motion.div>
        </div>

        {/* Hero Interactive Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-14"
        >
          <HeroEditorMockup />
        </motion.div>
      </section>

      {/* Metrics & Social Proof Bar */}
      <section className="border-y border-ink-200/60 bg-white/70 backdrop-blur-sm py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-ink-900">&lt; 10ms</p>
              <p className="text-xs sm:text-sm font-medium text-ink-500 mt-1">Sync Latency</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-ink-900">99.99%</p>
              <p className="text-xs sm:text-sm font-medium text-ink-500 mt-1">Uptime Reliability</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-ink-900">10,000+</p>
              <p className="text-xs sm:text-sm font-medium text-ink-500 mt-1">Active Rooms</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-ink-900">100%</p>
              <p className="text-xs sm:text-sm font-medium text-ink-500 mt-1">Data Durability</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-4 max-w-2xl mx-auto mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-accent-600">Built for speed & clarity</h2>
          <p className="text-3xl sm:text-4xl font-bold tracking-tight text-ink-900">
            Everything your team needs to collaborate seamlessly
          </p>
          <p className="text-ink-600 text-base">
            No delays, no missing edits, no confusion. Purpose-built tools designed for modern document creation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              whileHover={{ y: -5 }}
              className="rounded-2xl border border-ink-200/80 bg-white p-7 shadow-xs hover:shadow-card-hover transition-all group"
            >
              <div className={`h-12 w-12 rounded-xl border flex items-center justify-center mb-5 ${f.color}`}>
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-ink-900 mb-2 group-hover:text-accent-600 transition-colors">
                {f.title}
              </h3>
              <p className="text-sm text-ink-600 leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Product Flow / How It Works */}
      <section id="how-it-works" className="py-20 bg-ink-900 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center space-y-4 max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-accent-300">Simple workflow</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">How Quill elevates team velocity</h2>
            <p className="text-ink-400 text-base">From initial draft to final publish in three seamless steps.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s, idx) => (
              <div key={s.step} className="relative rounded-2xl border border-ink-800 bg-ink-950/60 p-8 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-black text-accent-400">{s.step}</span>
                  <div className="h-10 w-10 rounded-xl bg-ink-800/80 flex items-center justify-center text-accent-300">
                    <s.icon className="h-5 w-5" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white">{s.title}</h3>
                <p className="text-sm text-ink-400 leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center space-y-4 max-w-2xl mx-auto mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-accent-600">Loved by product teams</h2>
          <p className="text-3xl sm:text-4xl font-bold tracking-tight text-ink-900">
            Trusted by creators and engineers
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.author}
              className="rounded-2xl border border-ink-200/80 bg-white p-7 shadow-xs flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex gap-1 text-amber-400">
                  {[...Array(5)].map((_, idx) => (
                    <Star key={idx} className="h-4 w-4 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-ink-700 leading-relaxed italic">"{t.quote}"</p>
              </div>

              <div className="flex items-center gap-3 pt-6 border-t border-ink-100 mt-6">
                <div className="h-10 w-10 rounded-full bg-accent-100 text-accent-800 flex items-center justify-center font-bold text-sm">
                  {t.author.charAt(0)}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-ink-900">{t.author}</h4>
                  <p className="text-xs text-ink-500">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="rounded-3xl bg-gradient-to-br from-ink-900 via-ink-800 to-indigo-950 p-10 sm:p-14 text-center text-white space-y-6 shadow-2xl relative overflow-hidden">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Ready to experience true real-time collaboration?
          </h2>
          <p className="text-ink-300 max-w-xl mx-auto text-base">
            Join thousands of teams crafting document workspaces with zero sync friction.
          </p>
          <div className="pt-2">
            <Link href={isLoggedIn ? "/workspaces" : "/login"}>
              <Button variant="primary" className="bg-white text-ink-900 hover:bg-ink-100 border-none h-12 px-8 text-base font-semibold">
                Get started today
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink-200/60 bg-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-ink-900 text-white flex items-center justify-center font-bold text-sm">
              Q
            </div>
            <span className="font-bold text-lg text-ink-900">Quill</span>
            <span className="text-xs text-ink-400 ml-2">© {new Date().getFullYear()} Quill Inc. All rights reserved.</span>
          </div>

          <div className="flex gap-6 text-sm text-ink-500">
            <a href="#features" className="hover:text-ink-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-ink-900 transition-colors">Workflow</a>
            <Link href="/login" className="hover:text-ink-900 transition-colors">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
