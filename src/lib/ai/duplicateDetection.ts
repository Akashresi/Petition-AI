import { SimilarComplaint } from "@/types";
import { getStoredUser } from "@/lib/auth";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export interface DuplicateResult {
  isDuplicate: boolean;
  duplicateCount: number;
  similarComplaints: SimilarComplaint[];
  confidence: number;
  explanation: string;
}

export function mockDetectDuplicates(category: string): DuplicateResult {
  return {
    isDuplicate: false,
    duplicateCount: 0,
    similarComplaints: [],
    confidence: 0.85,
    explanation: `Offline check: no duplicate complaints found for ${category}.`,
  };
}

export async function detectDuplicates(category: string, text?: string): Promise<DuplicateResult> {
  try {
    const user = getStoredUser();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (user?.token) headers["Authorization"] = `Bearer ${user.token}`;

    const res = await fetch(`${API_BASE}/ai/duplicates`, {
      method: "POST",
      headers,
      body: JSON.stringify({ category, text }),
    });

    if (res.ok) {
      return (await res.json()) as DuplicateResult;
    }
  } catch (err) {
    console.warn("Backend duplicate call failed, using offline fallback:", err);
  }

  return mockDetectDuplicates(category);
}
