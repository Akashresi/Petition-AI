import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?:
    | "default"
    | "gold"
    | "royal"
    | "slaSafe"
    | "slaBreach"
    | "critical"
    | "medium"
    | "success"
    | "review"
    | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
  icon?: React.ReactNode;
}

export function Badge({
  children,
  variant = "default",
  size = "md",
  className = "",
  icon,
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: "bg-surface-card text-foreground border border-surface-border",
    gold: "bg-gold-500/20 text-gold-300 border border-gold-500/40 uppercase font-bold",
    royal: "bg-navy-800/90 text-blue-300 border border-navy-600/70",
    slaSafe: "bg-emerald-950/40 text-emerald-400 border border-emerald-500/60",
    slaBreach: "bg-red-950/50 text-red-400 border border-red-500/60",
    critical: "bg-red-950/60 text-red-400 border border-red-700/60 font-bold uppercase",
    medium: "bg-amber-950/60 text-amber-300 border border-amber-700/60 font-bold uppercase",
    success: "bg-emerald-950/50 text-emerald-300 border border-emerald-700/60",
    review: "bg-amber-950/50 text-amber-300 border border-amber-600/60",
    outline: "border border-border text-muted-foreground bg-transparent",
  };

  const sizeStyles = {
    sm: "text-[10px] px-2 py-0.5 rounded-full gap-1",
    md: "text-xs px-2.5 py-1 rounded-full gap-1.5",
    lg: "text-sm px-3.5 py-1.5 rounded-full gap-2 font-medium",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium leading-none select-none transition-colors",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}

export default Badge;
