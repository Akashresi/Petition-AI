import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { ComplaintStatus, Priority, Sentiment } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function statusLabel(status: ComplaintStatus): string {
  const map: Record<ComplaintStatus, string> = {
    submitted: "Submitted",
    under_review: "Under Review",
    assigned: "Assigned",
    in_progress: "In Progress",
    resolved: "Resolved",
    closed: "Closed",
  };
  return map[status] || status;
}

export function statusClass(status: ComplaintStatus): string {
  const map: Record<ComplaintStatus, string> = {
    submitted: "status-submitted",
    under_review: "status-review",
    assigned: "status-assigned",
    in_progress: "status-progress",
    resolved: "status-resolved",
    closed: "status-closed",
  };
  return map[status] || "";
}

export function priorityClass(priority: Priority): string {
  const map: Record<Priority, string> = {
    critical: "priority-critical",
    high: "priority-high",
    medium: "priority-medium",
    low: "priority-low",
  };
  return map[priority] || "";
}

export function sentimentColor(sentiment: Sentiment): string {
  const map: Record<Sentiment, string> = {
    positive: "text-green-600",
    neutral: "text-blue-600",
    negative: "text-orange-600",
    angry: "text-red-600",
  };
  return map[sentiment] || "text-gray-600";
}

export function sentimentBg(sentiment: Sentiment): string {
  const map: Record<Sentiment, string> = {
    positive: "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800/60",
    neutral: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60",
    negative: "bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800/60",
    angry: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60",
  };
  return map[sentiment] || "bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700";
}

export function generatePetitionId(): string {
  const year = new Date().getFullYear();
  const num = String(Math.floor(Math.random() * 900) + 100).padStart(3, "0");
  return `PET-${year}-${num}`;
}

export function confidenceBar(score: number): string {
  if (score >= 0.9) return "bg-green-500";
  if (score >= 0.75) return "bg-blue-500";
  if (score >= 0.6) return "bg-yellow-500";
  return "bg-red-500";
}

export { generateAIAnalysis, generateAIAnalysisSync, generateMockAIAnalysis } from "./ai";
