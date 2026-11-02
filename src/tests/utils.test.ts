import { describe, it, expect } from "vitest";
import { confidenceBar, statusLabel, statusClass, priorityClass, generatePetitionId } from "@/lib/utils";

describe("Frontend General Utilities", () => {
  it("formats status labels correctly", () => {
    expect(statusLabel("submitted")).toBe("Submitted");
    expect(statusLabel("under_review")).toBe("Under Review");
    expect(statusLabel("in_progress")).toBe("In Progress");
    expect(statusLabel("resolved")).toBe("Resolved");
    expect(statusLabel("closed")).toBe("Closed");
  });

  it("assigns appropriate badge color classes for status", () => {
    expect(statusClass("submitted")).toBe("status-submitted");
    expect(statusClass("resolved")).toBe("status-resolved");
    expect(statusClass("under_review")).toBe("status-review");
  });

  it("assigns appropriate badge color classes for priority", () => {
    expect(priorityClass("critical")).toBe("priority-critical");
    expect(priorityClass("high")).toBe("priority-high");
    expect(priorityClass("medium")).toBe("priority-medium");
    expect(priorityClass("low")).toBe("priority-low");
  });

  it("renders correct color class for confidence thresholds", () => {
    expect(confidenceBar(0.95)).toBe("bg-green-500");
    expect(confidenceBar(0.80)).toBe("bg-blue-500");
    expect(confidenceBar(0.65)).toBe("bg-yellow-500");
    expect(confidenceBar(0.40)).toBe("bg-red-500");
  });

  it("generates petition IDs with correct year prefix format", () => {
    const id = generatePetitionId();
    const currentYear = new Date().getFullYear();
    expect(id).toMatch(new RegExp(`^PET-${currentYear}-\\d{3}$`));
  });
});
