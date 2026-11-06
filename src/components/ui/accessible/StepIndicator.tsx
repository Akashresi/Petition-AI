import React from "react";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps?: number;
  stepLabels?: string[];
  className?: string;
}

export default function StepIndicator({
  currentStep,
  totalSteps = 4,
  stepLabels = ["Problem", "Location", "Photo", "Review"],
  className = "",
}: StepIndicatorProps) {
  const currentLabel = stepLabels[currentStep - 1] || "";

  return (
    <div
      className={`w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-4 dark:bg-slate-800/80 dark:border-slate-700 ${className}`}
      aria-label={`Step ${currentStep} of ${totalSteps}: ${currentLabel}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
          Step {currentStep} of {totalSteps}
        </span>
        {currentLabel && (
          <span className="text-lg font-semibold text-blue-900 bg-blue-100 px-3 py-1 rounded-lg border border-blue-300 dark:text-blue-200 dark:bg-blue-900/60 dark:border-blue-700">
            {currentLabel}
          </span>
        )}
      </div>

      {/* High contrast step progress dots / bar */}
      <div className="grid grid-cols-4 gap-2" role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={totalSteps}>
        {Array.from({ length: totalSteps }).map((_, idx) => {
          const stepNum = idx + 1;
          const isDone = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;

          return (
            <div
              key={stepNum}
              className={`h-3 rounded-full transition-all ${
                isDone
                  ? "bg-emerald-600 dark:bg-emerald-500"
                  : isCurrent
                  ? "bg-blue-800 dark:bg-blue-500 ring-2 ring-blue-400"
                  : "bg-slate-200 dark:bg-slate-700"
              }`}
              title={`Step ${stepNum}: ${stepLabels[idx] || ""}`}
            />
          );
        })}
      </div>
    </div>
  );
}

