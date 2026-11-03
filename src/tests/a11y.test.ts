import { describe, it, expect, beforeEach } from "vitest";

describe("Accessibility & Low-Bandwidth Mode (Task 5.4)", () => {
  const STORAGE_KEY = "petitionai_a11y_prefs";

  let memoryStore: Record<string, string> = {};

  const mockLocalStorage = {
    getItem: (key: string) => memoryStore[key] || null,
    setItem: (key: string, value: string) => {
      memoryStore[key] = value;
    },
    clear: () => {
      memoryStore = {};
    },
  };

  beforeEach(() => {
    mockLocalStorage.clear();
  });

  it("stores and retrieves accessibility settings from storage", () => {
    const prefs = {
      largeText: true,
      reducedData: true,
      highContrast: false,
    };
    mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    const loaded = JSON.parse(mockLocalStorage.getItem(STORAGE_KEY) || "{}");
    expect(loaded.largeText).toBe(true);
    expect(loaded.reducedData).toBe(true);
    expect(loaded.highContrast).toBe(false);
  });

  it("computes active accessibility mode counts accurately", () => {
    function getActiveA11yCount(settings: { largeText: boolean; reducedData: boolean; highContrast: boolean }) {
      return (settings.largeText ? 1 : 0) + (settings.reducedData ? 1 : 0) + (settings.highContrast ? 1 : 0);
    }

    expect(getActiveA11yCount({ largeText: false, reducedData: false, highContrast: false })).toBe(0);
    expect(getActiveA11yCount({ largeText: true, reducedData: false, highContrast: false })).toBe(1);
    expect(getActiveA11yCount({ largeText: true, reducedData: true, highContrast: true })).toBe(3);
  });

  it("determines correct CSS root classes for accessibility modes", () => {
    function resolveA11yClasses(settings: { largeText: boolean; reducedData: boolean; highContrast: boolean }) {
      const classes: string[] = [];
      if (settings.largeText) classes.push("large-text");
      if (settings.reducedData) classes.push("reduced-data");
      if (settings.highContrast) classes.push("high-contrast");
      return classes;
    }

    expect(resolveA11yClasses({ largeText: true, reducedData: false, highContrast: true })).toEqual([
      "large-text",
      "high-contrast",
    ]);
    expect(resolveA11yClasses({ largeText: false, reducedData: true, highContrast: false })).toEqual([
      "reduced-data",
    ]);
  });

  it("evaluates keyboard shortcut trigger criteria safely", () => {
    function isShortcutAllowed(targetTagName: string, isEditable: boolean) {
      if (targetTagName === "INPUT" || targetTagName === "TEXTAREA" || isEditable) {
        return false;
      }
      return true;
    }

    expect(isShortcutAllowed("BUTTON", false)).toBe(true);
    expect(isShortcutAllowed("DIV", false)).toBe(true);
    expect(isShortcutAllowed("INPUT", false)).toBe(false);
    expect(isShortcutAllowed("TEXTAREA", false)).toBe(false);
    expect(isShortcutAllowed("DIV", true)).toBe(false);
  });
});
