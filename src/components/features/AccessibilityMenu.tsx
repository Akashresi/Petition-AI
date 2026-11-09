import { useState, useRef, useEffect } from "react";
import {
  Accessibility,
  Type,
  WifiOff,
  Eye,
  RotateCcw,
  Keyboard,
  X,
  Check,
} from "lucide-react";
import { useAccessibility } from "@/hooks/useAccessibility";

export default function AccessibilityMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const {
    largeText,
    reducedData,
    highContrast,
    toggleLargeText,
    toggleReducedData,
    toggleHighContrast,
    resetA11y,
    isKeyboardHelpOpen,
    setIsKeyboardHelpOpen,
  } = useAccessibility();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const activeCount = (largeText ? 1 : 0) + (reducedData ? 1 : 0) + (highContrast ? 1 : 0);

  return (
    <div className="relative" ref={menuRef}>
      {/* Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors flex items-center justify-center"
        aria-label="Accessibility & Low Bandwidth Settings (Alt+A)"
        title="Accessibility Settings (Alt+A)"
      >
        <Accessibility className="w-5 h-5" />
        {activeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-500 text-slate-950 text-[10px] font-bold rounded-full flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-72 bg-surface-card rounded-2xl shadow-2xl border border-surface-border p-4 z-50 text-foreground space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Accessibility className="w-4 h-4 text-amber-500" />
              <h3 className="font-display font-bold text-sm">Accessibility & Data</h3>
            </div>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={resetA11y}
                className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1"
                title="Reset to default settings"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            )}
          </div>

          <div className="space-y-2">
            {/* Large Text */}
            <button
              type="button"
              onClick={toggleLargeText}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition-colors ${
                largeText
                  ? "bg-amber-50/80 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-200 font-semibold"
                  : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Type className="w-4 h-4 text-amber-500 shrink-0" />
                <div>
                  <div className="font-medium">Large Text</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    Scale font size (+18%) for reading comfort
                  </div>
                </div>
              </div>
              {largeText && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
            </button>

            {/* High Contrast */}
            <button
              type="button"
              onClick={toggleHighContrast}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition-colors ${
                highContrast
                  ? "bg-amber-50/80 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-200 font-semibold"
                  : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Eye className="w-4 h-4 text-amber-500 shrink-0" />
                <div>
                  <div className="font-medium">High Contrast</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    WCAG AAA contrast & bold focus outlines
                  </div>
                </div>
              </div>
              {highContrast && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
            </button>

            {/* Reduced Data Mode */}
            <button
              type="button"
              onClick={toggleReducedData}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition-colors ${
                reducedData
                  ? "bg-emerald-50/80 border-emerald-300 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-200 font-semibold"
                  : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <WifiOff className="w-4 h-4 text-emerald-500 shrink-0" />
                <div>
                  <div className="font-medium">Reduced Data Mode</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    Disable animations & media for 2G/3G links
                  </div>
                </div>
              </div>
              {reducedData && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
            </button>

            {/* Keyboard Shortcuts */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsKeyboardHelpOpen(true);
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left text-xs transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Keyboard className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <div className="font-medium">Keyboard Navigation</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    Press <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono">?</kbd> for shortcuts
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {isKeyboardHelpOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <Keyboard className="w-5 h-5 text-amber-500" />
                <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
                  Keyboard Shortcuts & Navigation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsKeyboardHelpOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-slate-700 dark:text-slate-300">Open Keyboard Shortcuts</span>
                <kbd className="px-2 py-1 rounded bg-white dark:bg-slate-900 font-mono font-bold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm">
                  ?
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-slate-700 dark:text-slate-300">Navigate via Focus Rings</span>
                <kbd className="px-2 py-1 rounded bg-white dark:bg-slate-900 font-mono font-bold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm">
                  Tab / Shift+Tab
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-slate-700 dark:text-slate-300">Activate Link / Button</span>
                <kbd className="px-2 py-1 rounded bg-white dark:bg-slate-900 font-mono font-bold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm">
                  Enter / Space
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-slate-700 dark:text-slate-300">Close Modals & Drawers</span>
                <kbd className="px-2 py-1 rounded bg-white dark:bg-slate-900 font-mono font-bold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm">
                  Escape
                </kbd>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsKeyboardHelpOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold text-xs transition-colors hover:opacity-90"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
