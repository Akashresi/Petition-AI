import React from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "bordered" | "headerBar";
  headerTitle?: string;
  headerSubtitle?: string;
  headerAction?: React.ReactNode;
}

export function Card({
  children,
  className = "",
  variant = "default",
  headerTitle,
  headerSubtitle,
  headerAction,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground rounded-2xl sm:rounded-3xl border border-border shadow-md transition-all duration-200 overflow-hidden",
        variant === "bordered" && "border-navy-700/60 shadow-lg",
        className
      )}
      {...props}
    >
      {headerTitle && (
        <div className="bg-navy-850 text-white px-5 sm:px-6 py-3.5 sm:py-4 border-b border-navy-700/60 flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-sm sm:text-base leading-tight text-white">{headerTitle}</h3>
            {headerSubtitle && <p className="text-xs text-navy-300 mt-0.5">{headerSubtitle}</p>}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className={headerTitle ? "p-5 sm:p-6" : ""}>{children}</div>
    </div>
  );
}

export default Card;

