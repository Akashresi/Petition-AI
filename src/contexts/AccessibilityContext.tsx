/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useEffect, useState } from "react";

export interface AccessibilitySettings {
  largeText: boolean;
  reducedData: boolean;
  highContrast: boolean;
}

interface AccessibilityContextType extends AccessibilitySettings {
  toggleLargeText: () => void;
  toggleReducedData: () => void;
  toggleHighContrast: () => void;
  resetA11y: () => void;
  isKeyboardHelpOpen: boolean;
  setIsKeyboardHelpOpen: (open: boolean) => void;
}

const STORAGE_KEY = "petitionai_a11y_prefs";

const DEFAULT_SETTINGS: AccessibilitySettings = {
  largeText: false,
  reducedData: false,
  highContrast: false,
};

export const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEFAULT_SETTINGS;
  });

  const [isKeyboardHelpOpen, setIsKeyboardHelpOpen] = useState(false);

  // Sync DOM classes
  useEffect(() => {
    const root = document.documentElement;
    if (settings.largeText) {
      root.classList.add("large-text");
    } else {
      root.classList.remove("large-text");
    }

    if (settings.reducedData) {
      root.classList.add("reduced-data");
    } else {
      root.classList.remove("reduced-data");
    }

    if (settings.highContrast) {
      root.classList.add("high-contrast");
    } else {
      root.classList.remove("high-contrast");
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  // Global keyboard shortcuts (Alt+Key navigation & ? help modal)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is currently typing in an input, textarea, or contentEditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "?" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setIsKeyboardHelpOpen((prev) => !prev);
      } else if (e.key === "Escape" && isKeyboardHelpOpen) {
        setIsKeyboardHelpOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isKeyboardHelpOpen]);

  const toggleLargeText = () =>
    setSettings((s) => ({ ...s, largeText: !s.largeText }));

  const toggleReducedData = () =>
    setSettings((s) => ({ ...s, reducedData: !s.reducedData }));

  const toggleHighContrast = () =>
    setSettings((s) => ({ ...s, highContrast: !s.highContrast }));

  const resetA11y = () => setSettings(DEFAULT_SETTINGS);

  return (
    <AccessibilityContext.Provider
      value={{
        ...settings,
        toggleLargeText,
        toggleReducedData,
        toggleHighContrast,
        resetA11y,
        isKeyboardHelpOpen,
        setIsKeyboardHelpOpen,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}
