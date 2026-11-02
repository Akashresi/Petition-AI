import { Priority } from "@/types";
import { getStoredUser } from "@/lib/auth";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export interface PriorityResult {
  priority: Priority;
  priorityScore: number;
  confidence: number;
  explanation: string;
}

export function mockPredictPriority(text: string): PriorityResult {
  const lower = text.toLowerCase();
  const criticalWords = ["accident", "emergency", "danger", "death", "flood", "fire", "collapse", "sewage overflow"];
  const highWords = ["broken", "leaking", "no water", "no electricity", "pothole", "blocked drain"];

  let priority: Priority = "medium";
  let score = 0.5;

  if (criticalWords.some(w => lower.includes(w))) {
    priority = "critical";
    score = 0.95;
  } else if (highWords.some(w => lower.includes(w))) {
    priority = "high";
    score = 0.75;
  } else if (lower.length < 50) {
    priority = "low";
    score = 0.25;
  }

  return {
    priority,
    priorityScore: score,
    confidence: score,
    explanation: `Offline priority prediction assigned ${priority.toUpperCase()} urgency.`,
  };
}

export async function predictPriority(text: string): Promise<PriorityResult> {
  try {
    const user = getStoredUser();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (user?.token) headers["Authorization"] = `Bearer ${user.token}`;

    const res = await fetch(`${API_BASE}/ai/priority`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text }),
    });

    if (res.ok) {
      return (await res.json()) as PriorityResult;
    }
  } catch (err) {
    console.warn("Backend priority call failed, using offline fallback:", err);
  }

  return mockPredictPriority(text);
}
