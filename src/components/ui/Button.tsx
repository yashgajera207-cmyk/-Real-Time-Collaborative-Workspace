"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  loading?: boolean;
  children: React.ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-ink-900 text-white hover:bg-ink-800 shadow-sm hover:shadow-md active:bg-ink-950 border border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/30",
  secondary:
    "bg-white text-ink-900 border border-ink-200 hover:border-ink-300 hover:bg-ink-50/80 shadow-xs focus-visible:ring-2 focus-visible:ring-accent-500/20",
  ghost:
    "bg-transparent text-ink-700 hover:bg-ink-100/70 hover:text-ink-900 active:bg-ink-200/50 focus-visible:ring-2 focus-visible:ring-accent-500/20",
  danger:
    "bg-red-50/80 text-red-600 border border-red-200/80 hover:bg-red-100/80 hover:border-red-300 active:bg-red-200/60 focus-visible:ring-2 focus-visible:ring-red-500/20",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", loading, disabled, className = "", children, ...props }, ref) => (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.1 }}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium
        transition-all duration-150 outline-none disabled:cursor-not-allowed disabled:opacity-50 select-none ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0 text-current" />}
      {children}
    </motion.button>
  )
);
Button.displayName = "Button";
