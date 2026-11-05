import React from "react";
import {
  Clock,
  Search,
  UserCheck,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  FileText,
  LucideIcon,
} from "lucide-react";

export type ComplaintStatusType =
  | "submitted"
  | "received"
  | "under_review"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "closed"
  | "escalated";

interface StatusConfig {
  label: string;
  icon: LucideIcon;
  classes: string;
  dotColor: string;
}

const STATUS_CONFIGS: Record<ComplaintStatusType, StatusConfig> = {
  submitted: {
    label: "Submitted",
    icon: FileText,
    classes: "bg-slate-100 text-slate-900 border-2 border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-400",
    dotColor: "bg-slate-700",
  },
  received: {
    label: "Received",
    icon: Clock,
    classes: "bg-slate-100 text-slate-900 border-2 border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-400",
    dotColor: "bg-slate-700",
  },
  under_review: {
    label: "Being Checked",
    icon: Search,
    classes: "bg-amber-50 text-amber-950 border-2 border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-500",
    dotColor: "bg-amber-600",
  },
  assigned: {
    label: "With Officer",
    icon: UserCheck,
    classes: "bg-blue-50 text-blue-950 border-2 border-blue-800 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-500",
    dotColor: "bg-blue-600",
  },
  in_progress: {
    label: "Work in Progress",
    icon: Wrench,
    classes: "bg-indigo-50 text-indigo-950 border-2 border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-500",
    dotColor: "bg-indigo-600",
  },
  resolved: {
    label: "Resolved",
    icon: CheckCircle2,
    classes: "bg-emerald-50 text-emerald-950 border-2 border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-500",
    dotColor: "bg-emerald-600",
  },
  closed: {
    label: "Closed",
    icon: CheckCircle2,
    classes: "bg-slate-200 text-slate-900 border-2 border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-500",
    dotColor: "bg-slate-600",
  },
  escalated: {
    label: "Escalated to Senior Officer",
    icon: AlertTriangle,
    classes: "bg-rose-50 text-rose-950 border-2 border-rose-800 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-500",
    dotColor: "bg-rose-600",
  },
};

interface StatusBadgeProps {
  status: string;
  customLabel?: string;
  size?: "default" | "large";
  className?: string;
}

export default function StatusBadge({
  status,
  customLabel,
  size = "default",
  className = "",
}: StatusBadgeProps) {
  const normalized = (status.toLowerCase().replace(/\s+/g, "_") as ComplaintStatusType) || "submitted";
  const config = STATUS_CONFIGS[normalized] || STATUS_CONFIGS.submitted;
  const Icon = config.icon;
  const displayLabel = customLabel || config.label;

  const sizeClasses =
    size === "large"
      ? "px-4 py-2 text-lg sm:text-xl font-bold gap-3"
      : "px-3 py-1.5 text-base sm:text-lg font-semibold gap-2";

  return (
    <span
      role="status"
      className={`inline-flex items-center rounded-lg shadow-sm ${config.classes} ${sizeClasses} ${className}`}
    >
      <Icon className={size === "large" ? "w-6 h-6 shrink-0" : "w-5 h-5 shrink-0"} aria-hidden="true" />
      <span className="leading-none">{displayLabel}</span>
    </span>
  );
}
