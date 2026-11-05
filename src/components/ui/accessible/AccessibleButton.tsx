import React from "react";
import { LucideIcon } from "lucide-react";

interface AccessibleButtonProps {
  children: React.ReactNode;
  icon?: LucideIcon;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: "primary" | "secondary" | "neutral" | "danger";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
  ariaLabel?: string;
  size?: "default" | "large";
}

export default function AccessibleButton({
  children,
  icon: Icon,
  onClick,
  variant = "primary",
  type = "button",
  disabled = false,
  fullWidth = false,
  className = "",
  ariaLabel,
  size = "default",
}: AccessibleButtonProps) {
  // Calm, high-contrast, non-neon color palette
  const variantStyles = {
    primary:
      "bg-blue-800 text-white hover:bg-blue-900 border-2 border-blue-900 active:bg-blue-950 focus-visible:ring-4 focus-visible:ring-blue-300 dark:bg-blue-700 dark:border-blue-600 dark:hover:bg-blue-800",
    secondary:
      "bg-white text-slate-900 hover:bg-slate-100 border-2 border-slate-700 active:bg-slate-200 focus-visible:ring-4 focus-visible:ring-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-500",
    neutral:
      "bg-slate-100 text-slate-900 hover:bg-slate-200 border-2 border-slate-400 active:bg-slate-300 focus-visible:ring-4 focus-visible:ring-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600",
    danger:
      "bg-rose-800 text-white hover:bg-rose-900 border-2 border-rose-900 active:bg-rose-950 focus-visible:ring-4 focus-visible:ring-rose-300 dark:bg-rose-700 dark:border-rose-600",
  };

  const sizeStyles = {
    default: "min-h-[48px] px-5 py-3 text-base sm:text-lg",
    large: "min-h-[56px] px-6 py-4 text-lg sm:text-xl font-bold",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`
        inline-flex items-center justify-center gap-3 rounded-xl font-semibold
        transition-colors cursor-pointer select-none text-left
        disabled:opacity-50 disabled:cursor-not-allowed
        focus-visible:outline-none shadow-sm
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? "w-full" : "w-auto"}
        ${className}
      `}
    >
      {Icon && <Icon className="w-6 h-6 shrink-0" aria-hidden="true" />}
      <span className="leading-tight">{children}</span>
    </button>
  );
}
