import { Sentiment } from "@/types";
import { getStoredUser } from "@/lib/auth";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export interface SentimentResult {
  sentiment: Sentiment;
  sentimentScore: number;
  confidence: number;
  explanation: string;
}

export function mockAnalyzeSentiment(text: string): SentimentResult {
  const lower = text.toLowerCase();
  const angryWords = ["angry", "furious", "unacceptable", "terrible", "worst", "disgusting", "outrageous", "frustrated"];
  const negativeWords = ["bad", "poor", "issue", "problem", "complaint", "broken", "damaged", "fail", "missing", "blocked"];
  const positiveWords = ["please", "kindly", "request", "hope", "appreciate", "grateful"];

  let sentiment: Sentiment = "neutral";
  let score = 0.5;

  if (angryWords.some(w => lower.includes(w))) {
    sentiment = "angry";
    score = 0.15;
  } else if (negativeWords.filter(w => lower.includes(w)).length >= 2) {
    sentiment = "negative";
    score = 0.3;
  } else if (positiveWords.some(w => lower.includes(w))) {
    sentiment = "positive";
    score = 0.75;
  }

  return {
    sentiment,
    sentimentScore: score,
    confidence: 0.85,
    explanation: `Offline sentiment evaluation classified tone as ${sentiment}.`,
  };
}

export async function analyzeSentiment(text: string): Promise<SentimentResult> {
  try {
    const user = getStoredUser();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (user?.token) headers["Authorization"] = `Bearer ${user.token}`;

    const res = await fetch(`${API_BASE}/ai/sentiment`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text }),
    });

    if (res.ok) {
      return (await res.json()) as SentimentResult;
    }
  } catch (err) {
    console.warn("Backend sentiment call failed, using offline fallback:", err);
  }

  return mockAnalyzeSentiment(text);
}
