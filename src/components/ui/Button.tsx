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
  primary: "bg-ink-900 text-white hover:bg-ink-800",
  secondary: "bg-white text-ink-900 border border-ink-200 hover:border-ink-400",
  ghost: "bg-transparent text-ink-600 hover:bg-ink-50",
  danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", loading, disabled, className = "", children, ...props }, ref) => (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12 }}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium
        transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </motion.button>
  )
);
Button.displayName = "Button";
