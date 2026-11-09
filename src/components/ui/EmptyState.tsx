import React from "react";
import { FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "card-reference p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4",
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-surface-cardLighter border border-surface-border flex items-center justify-center text-muted-foreground">
        {icon || <FolderOpen className="w-7 h-7 text-muted-foreground/70" />}
      </div>
      <div className="max-w-sm space-y-1">
        <h4 className="font-display font-bold text-base sm:text-lg text-foreground">{title}</h4>
        {description && <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{description}</p>}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

export default EmptyState;

