import { getStoredUser } from "@/lib/auth";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export interface ClassificationResult {
  category?: string;
  department: string;
  categoryConfidence: number;
  departmentConfidence: number;
  confidence: number;
  explanation: string;
  human_review_required?: boolean;
}

const DEPT_FALLBACK_MAP: Record<string, string> = {
  "Road & Infrastructure": "Roads & Infrastructure",
  "Building & Construction": "Roads & Infrastructure",
  "Water Supply": "Water Works",
  "Sanitation": "Waste Management",
  "Electricity": "Electricity Board",
  "Waste Management": "Waste Management",
  "Parks & Recreation": "Waste Management",
  "Noise Pollution": "Public Safety",
  "Public Safety": "Public Safety",
  "Healthcare": "Health Department",
  "Education": "Education Department",
  "Public Transport": "Transport Authority",
};

export function mockClassifyCategoryAndDepartment(category: string): ClassificationResult {
  const dept = DEPT_FALLBACK_MAP[category] || "Roads & Infrastructure";
  return {
    department: dept,
    categoryConfidence: 0.88,
    departmentConfidence: 0.85,
    confidence: 0.88,
    explanation: `Classified as ${category} routed to ${dept} via offline heuristic fallback.`,
  };
}

export async function classifyCategoryAndDepartment(
  category: string,
  text?: string
): Promise<ClassificationResult> {
  try {
    const user = getStoredUser();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (user?.token) headers["Authorization"] = `Bearer ${user.token}`;

    const res = await fetch(`${API_BASE}/ai/classify`, {
      method: "POST",
      headers,
      body: JSON.stringify({ category, text }),
    });

    if (res.ok) {
      return (await res.json()) as ClassificationResult;
    }
  } catch (err) {
    console.warn("Backend classify call failed, using offline fallback:", err);
  }

  return mockClassifyCategoryAndDepartment(category);
}
