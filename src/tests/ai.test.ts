import { describe, it, expect } from "vitest";
import {
  mockClassifyCategoryAndDepartment,
  mockAnalyzeSentiment,
  mockPredictPriority,
  mockDetectDuplicates,
  generateMockAIAnalysis,
} from "@/lib/ai";

describe("Frontend Thin AI Client & Fallbacks", () => {
  it("routes categories to appropriate departments offline with confidence & explanation", () => {
    const result = mockClassifyCategoryAndDepartment("Water Supply");
    expect(result.department).toBe("Water Works");
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.explanation).toContain("Water Supply");
  });

  it("detects sentiment correctly from text", () => {
    const angry = mockAnalyzeSentiment("This is terrible, unacceptable and disgusting service!");
    expect(angry.sentiment).toBe("angry");
    expect(angry.sentimentScore).toBeLessThan(0.3);
    expect(angry.explanation).toBeDefined();

    const positive = mockAnalyzeSentiment("Thank you very much, I appreciate the prompt help.");
    expect(positive.sentiment).toBe("positive");
    expect(positive.sentimentScore).toBeGreaterThan(0.6);
  });

  it("predicts critical urgency for emergency keywords", () => {
    const critical = mockPredictPriority("Emergency fire accident and collapse danger!");
    expect(critical.priority).toBe("critical");
    expect(critical.priorityScore).toBeGreaterThanOrEqual(0.9);
    expect(critical.confidence).toBeGreaterThanOrEqual(0.9);
    expect(critical.explanation).toContain("CRITICAL");
  });

  it("produces a comprehensive AIAnalysis object with confidence and explanation", () => {
    const analysis = generateMockAIAnalysis(
      "Main water pipeline leak",
      "Drinking water pipeline broken near bus stop, flooding road.",
      "Water Supply"
    );

    expect(analysis.category).toBe("Water Supply");
    expect(analysis.department).toBe("Water Works");
    expect(analysis.priority).toBeDefined();
    expect(analysis.summaryNote).toContain("AI classified this as Water Supply");
    expect(analysis.keywords.length).toBeGreaterThan(0);
  });
});
