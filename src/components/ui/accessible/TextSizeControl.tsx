import React from "react";
import { useAccessibility } from "@/hooks/useAccessibility";

interface TextSizeControlProps {
  className?: string;
  size?: "default" | "compact";
}

export default function TextSizeControl({
  className = "",
  size = "default",
}: TextSizeControlProps) {
  const { textSizeLevel, increaseTextSize, decreaseTextSize } = useAccessibility();

  const buttonSize =
    size === "compact"
      ? "min-w-[44px] min-h-[44px] text-base"
      : "min-w-[48px] min-h-[48px] text-lg";

  return (
    <div
      className={`inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border-2 border-slate-400 dark:bg-slate-800 dark:border-slate-600 ${className}`}
      role="group"
      aria-label="Text Size Controls"
    >
      <button
        type="button"
        onClick={decreaseTextSize}
        disabled={textSizeLevel <= 1}
        className={`
          ${buttonSize} px-3 py-2 font-bold rounded-lg transition-colors
          flex items-center justify-center
          bg-white text-slate-900 hover:bg-slate-200 border border-slate-300
          disabled:opacity-40 disabled:cursor-not-allowed
          dark:bg-slate-700 dark:text-slate-100 dark:border-slate-500 dark:hover:bg-slate-600
        `}
        aria-label="Decrease text size (A-)"
        title="Decrease text size"
      >
        <span className="font-extrabold text-sm sm:text-base">A−</span>
      </button>

      <span
        className="px-2 font-mono text-sm sm:text-base font-bold text-slate-700 dark:text-slate-300 select-none"
        aria-live="polite"
        title="Current text zoom level"
      >
        {textSizeLevel}x
      </span>

      <button
        type="button"
        onClick={increaseTextSize}
        disabled={textSizeLevel >= 6}
        className={`
          ${buttonSize} px-3 py-2 font-bold rounded-lg transition-colors
          flex items-center justify-center
          bg-white text-slate-900 hover:bg-slate-200 border border-slate-300
          disabled:opacity-40 disabled:cursor-not-allowed
          dark:bg-slate-700 dark:text-slate-100 dark:border-slate-500 dark:hover:bg-slate-600
        `}
        aria-label="Increase text size (A+)"
        title="Increase text size"
      >
        <span className="font-extrabold text-base sm:text-lg">A+</span>
      </button>
    </div>
  );
}
