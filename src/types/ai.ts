import { Priority, ComplaintStatus } from "./petition";

export type Sentiment = "positive" | "neutral" | "negative" | "angry";

export interface SimilarComplaint {
  id: string;
  title: string;
  similarity: number;
  status: ComplaintStatus;
}

export interface AIAnalysis {
  category: string;
  categoryConfidence: number;
  department: string;
  departmentConfidence: number;
  priority: Priority;
  priorityScore: number;
  sentiment: Sentiment;
  sentimentScore: number;
  isDuplicate: boolean;
  duplicateCount: number;
  similarComplaints: SimilarComplaint[];
  urgencyLevel: "critical" | "high" | "medium" | "low";
  keywords: string[];
  contributingKeywords?: string[];
  summaryNote: string;
  confidence?: number;
  explanation?: string;
  priorityReason?: string;
  human_review_required?: boolean;
  review_reasons?: string[];
  is_spam?: boolean;
  is_abusive?: boolean;
  spam_reason?: string;
  abuse_reason?: string;
}
