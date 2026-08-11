"use client";

import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-ink-800">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={`h-10 rounded-lg border px-3 text-sm outline-none transition-shadow
          placeholder:text-ink-400
          ${error ? "border-red-300 focus:shadow-[0_0_0_3px_rgba(227,74,74,0.15)]" : "border-ink-200 focus:border-accent-400 focus:shadow-[0_0_0_3px_rgba(55,138,221,0.15)]"}
          ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
);
Input.displayName = "Input";
