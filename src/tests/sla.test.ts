import { describe, it, expect } from "vitest";
import { SLA_DEADLINES, calculateSLADeadline, getSLAStatus, getSLAColor } from "@/lib/sla";
import { generateMockAIAnalysis } from "@/lib/ai";
import { Complaint } from "@/types";

describe("SLA Calculation Utilities", () => {
  it("defines expected SLA deadline windows per priority", () => {
    expect(SLA_DEADLINES.critical).toBe(24);
    expect(SLA_DEADLINES.high).toBe(72);
    expect(SLA_DEADLINES.medium).toBe(168);
    expect(SLA_DEADLINES.low).toBe(336);
  });

  it("calculates correct deadline ISO timestamp based on submittedAt", () => {
    const submittedAt = "2026-01-01T00:00:00.000Z";
    const deadline = calculateSLADeadline(submittedAt, "critical");
    const diffHours = (new Date(deadline).getTime() - new Date(submittedAt).getTime()) / (1000 * 60 * 60);
    expect(diffHours).toBe(24);
  });

  it("identifies overdue complaints", () => {
    const pastDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const mockComplaint: Complaint = {
      id: "c_test",
      petitionId: "PET-2026-001",
      title: "Test Overdue",
      description: "Test description",
      category: "Water Supply",
      location: "Central",
      district: "Coimbatore",
      submittedBy: "u1",
      submittedByName: "Citizen",
      submittedAt: pastDate,
      status: "in_progress",
      priority: "critical",
      assignedDepartment: "Water Works",
      aiAnalysis: generateMockAIAnalysis("Test Overdue", "Test description", "Water Supply"),
      statusHistory: [],
      reopenCount: 0,
      isEscalated: false,
    };

    const status = getSLAStatus(mockComplaint);
    expect(status.isOverdue).toBe(true);
    expect(status.label).toContain("Overdue");
  });

  it("returns proper color codes for SLA progression", () => {
    expect(getSLAColor(true, 100)).toContain("red");
    expect(getSLAColor(false, 95)).toContain("orange");
    expect(getSLAColor(false, 60)).toContain("yellow");
    expect(getSLAColor(false, 20)).toContain("green");
  });
});
