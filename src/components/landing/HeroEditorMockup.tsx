"use client";

import { motion } from "framer-motion";
import { MessageSquare, Sparkles, CheckCircle2, ShieldCheck, Users, FileText } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

export function HeroEditorMockup() {
  return (
    <div className="relative mx-auto w-full max-w-5xl rounded-2xl border border-ink-200/80 bg-white shadow-2xl overflow-hidden transition-all">
      {/* Editor Header Bar */}
      <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50/70 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-400/80" />
            <div className="h-3 w-3 rounded-full bg-amber-400/80" />
            <div className="h-3 w-3 rounded-full bg-emerald-400/80" />
          </div>
          <div className="h-4 w-px bg-ink-200" />
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-accent-600" />
            <span className="text-xs sm:text-sm font-semibold text-ink-800 truncate max-w-[180px] sm:max-w-none">
              Q3 Product Architecture & Launch Strategy
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live Sync Badge */}
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="hidden sm:inline">Real-time Connected</span>
            <span className="sm:hidden">Live</span>
          </div>

          {/* Active Collaborators Stack */}
          <div className="flex items-center -space-x-2">
            <Avatar name="Owen Owner" size={26} />
            <Avatar name="Edie Editor" size={26} />
            <Avatar name="Cam Commenter" size={26} />
          </div>
        </div>
      </div>

      {/* Editor Body Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 min-h-[420px]">
        {/* Main Document Content Area */}
        <div className="lg:col-span-8 p-6 sm:p-8 space-y-6 relative bg-white">
          {/* Document Title */}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-accent-600">
              Workspace / Strategic Specs
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-ink-900 mt-1">
              Q3 Product Architecture & Launch Strategy
            </h2>
          </div>

          {/* Document Paragraph 1 with Simulated Animated Cursor 1 */}
          <div className="relative text-sm sm:text-base text-ink-700 leading-relaxed font-sans">
            Our goal for Q3 is to achieve sub-10ms synchronization latency across all global document rooms.
            By utilizing Yjs CRDTs over persistent WebSocket channels, edits resolve deterministically without central lock contention.
            
            {/* Simulated Live Cursor 1 (Edie Editor) */}
            <motion.span
              animate={{
                x: [0, 40, 40, 120, 120, 0],
                y: [0, 0, 24, 24, 0, 0],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="inline-block relative ml-0.5"
            >
              <span className="inline-block w-0.5 h-5 bg-purple-600 align-middle" />
              <span className="absolute -top-6 left-0 rounded-md bg-purple-600 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm whitespace-nowrap">
                Edie Editor
              </span>
            </motion.span>
          </div>

          {/* Highlighted text block with anchored comment */}
          <div className="relative bg-amber-50/80 border-l-4 border-amber-400 p-4 rounded-r-xl">
            <p className="text-sm text-amber-900 font-medium">
              "Every change is persisted incrementally to Postgres before broadcast, ensuring 100% durability."
            </p>

            {/* Simulated Live Cursor 2 (Cam Commenter) */}
            <motion.span
              animate={{
                x: [80, 0, 80],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute right-4 top-2"
            >
              <span className="inline-block w-0.5 h-5 bg-amber-600 align-middle" />
              <span className="absolute -top-6 left-0 rounded-md bg-amber-600 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm whitespace-nowrap">
                Cam Commenter
              </span>
            </motion.span>
          </div>

          {/* Checklist Feature Demo */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-400">Launch Milestones</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 text-sm text-ink-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="line-through text-ink-400">Implement WebSocket sync server with Fastify & Yjs</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-ink-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="line-through text-ink-400">Add fine-grained document ACL permissions</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-ink-800 font-semibold">
                <div className="h-4 w-4 rounded border-2 border-accent-500 bg-accent-50 flex items-center justify-center shrink-0">
                  <div className="h-2 w-2 rounded-xs bg-accent-600" />
                </div>
                <span>Deploy automatic snapshot compaction and version diffing</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Sidebar Preview (Anchored Comments & Versioning) */}
        <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-ink-100 bg-ink-50/50 p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-ink-200/60">
            <div className="flex items-center gap-2 text-ink-800 font-semibold text-xs uppercase tracking-wider">
              <MessageSquare className="h-3.5 w-3.5 text-accent-600" />
              <span>Live Comment Thread</span>
            </div>
            <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-bold text-accent-700">
              1 Active
            </span>
          </div>

          {/* Comment Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="rounded-xl border border-amber-200/80 bg-white p-3.5 shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar name="Cam Commenter" size={24} />
                <div>
                  <p className="text-xs font-bold text-ink-900">Cam Commenter</p>
                  <p className="text-[10px] text-ink-400">2 mins ago</p>
                </div>
              </div>
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                Commenter
              </span>
            </div>

            <p className="text-xs text-ink-700 leading-normal">
              Should we benchmark memory overhead when opening 50+ concurrent rooms on a single worker node?
            </p>

            <div className="rounded-lg bg-ink-50 p-2.5 text-[11px] space-y-1.5 border border-ink-100">
              <div className="flex items-center gap-1.5">
                <Avatar name="Owen Owner" size={18} />
                <span className="font-bold text-ink-800">Owen Owner</span>
              </div>
              <p className="text-ink-600">
                Good catch! Tested up to 10k rooms with 5MB total RSS overhead per room.
              </p>
            </div>
          </motion.div>

          {/* Version History Mini Widget */}
          <div className="rounded-xl border border-ink-200/60 bg-white p-3.5 space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-ink-800">
              <span>Version History</span>
              <span className="text-[10px] text-accent-600">Auto-saved</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-ink-500">
              <span>Snapshot #14 — Owen Owner</span>
              <span className="text-emerald-600 font-medium">+42 words</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
