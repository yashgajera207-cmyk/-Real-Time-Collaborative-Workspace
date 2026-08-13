"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "./Button";

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  loading?: boolean;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Delete",
  cancelText = "Cancel",
  variant = "danger",
  loading = false,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-ink-950/60 backdrop-blur-xs"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="relative w-full max-w-sm rounded-2xl border border-ink-200/80 bg-white p-6 shadow-2xl overflow-hidden"
          >
            <button
              onClick={onClose}
              disabled={loading}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-800 transition-colors disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col items-center text-center space-y-3">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                  variant === "danger"
                    ? "bg-red-50 text-red-600 border-red-200"
                    : "bg-amber-50 text-amber-600 border-amber-200"
                }`}
              >
                <AlertTriangle className="h-6 w-6 shrink-0" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-ink-900">{title}</h3>
                <p className="text-xs text-ink-500 leading-relaxed">{description}</p>
              </div>

              <div className="flex w-full gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading}
                  onClick={onClose}
                  className="flex-1 h-9 text-xs font-semibold"
                >
                  {cancelText}
                </Button>
                <Button
                  type="button"
                  loading={loading}
                  onClick={onConfirm}
                  className={`flex-1 h-9 text-xs font-semibold text-white shadow-xs ${
                    variant === "danger"
                      ? "bg-red-600 hover:bg-red-700 focus:ring-red-500"
                      : "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500"
                  }`}
                >
                  {confirmText}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
