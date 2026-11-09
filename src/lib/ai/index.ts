import { AIAnalysis } from "@/types";
import { getStoredUser } from "@/lib/auth";
import { analyzeSentiment, mockAnalyzeSentiment } from "./sentimentAnalysis";
import { predictPriority, mockPredictPriority } from "./priorityPrediction";
import { classifyCategoryAndDepartment, mockClassifyCategoryAndDepartment } from "./classification";
import { detectDuplicates, mockDetectDuplicates } from "./duplicateDetection";

export * from "./sentimentAnalysis";
export * from "./priorityPrediction";
export * from "./classification";
export * from "./duplicateDetection";
export * from "./imageAnalysis";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export function generateMockAIAnalysis(
  title: string,
  description: string,
  category: string
): AIAnalysis {
  const fullText = `${title} ${description}`;
  const s = mockAnalyzeSentiment(fullText);
  const p = mockPredictPriority(fullText);
  const c = mockClassifyCategoryAndDepartment(category);
  const d = mockDetectDuplicates(category);

  const words = fullText
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 5);
  const keywords = [...new Set(words)].slice(0, 6);

  return {
    category,
    categoryConfidence: c.categoryConfidence,
    department: c.department,
    departmentConfidence: c.departmentConfidence,
    priority: p.priority,
    priorityScore: p.priorityScore,
    sentiment: s.sentiment,
    sentimentScore: s.sentimentScore,
    isDuplicate: d.isDuplicate,
    duplicateCount: d.duplicateCount,
    similarComplaints: d.similarComplaints,
    urgencyLevel: p.priority,
    keywords: keywords.length > 0 ? keywords : ["complaint", "repair", "service"],
    contributingKeywords: keywords.length > 0 ? keywords : ["complaint", "repair", "service"],
    priorityReason: `Assigned ${p.priority} priority based on offline civic urgency heuristic.`,
    summaryNote: `AI classified this as ${category} (${Math.round(
      c.categoryConfidence * 100
    )}% confidence). Routed to ${c.department}. Priority: ${p.priority.toUpperCase()}. Confidence: ${Math.round(c.confidence * 100)}% - ${c.explanation}`,
  };
}

/**
 * Generate full AI analysis by calling the backend /api/ai/analyze endpoint
 * with graceful fallback to offline mock analysis.
 */
export async function generateAIAnalysis(
  title: string,
  description: string,
  category: string,
  location?: string,
  district?: string
): Promise<AIAnalysis> {
  try {
    const user = getStoredUser();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (user?.token) headers["Authorization"] = `Bearer ${user.token}`;

    const res = await fetch(`${API_BASE}/ai/analyze`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title, description, category, location, district }),
    });

    if (res.ok) {
      const data: AIAnalysis = await res.json();
      return data;
    }
  } catch (err) {
    console.warn("Backend /api/ai/analyze unavailable, using offline fallback:", err);
  }

  return generateMockAIAnalysis(title, description, category);
}

// Synchronous helper for mock data generators
export function generateAIAnalysisSync(
  title: string,
  description: string,
  category: string
): AIAnalysis {
  return generateMockAIAnalysis(title, description, category);
}
