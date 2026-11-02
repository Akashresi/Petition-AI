import { AIAnalysis } from "./ai";

export type ComplaintStatus =
  | "submitted"
  | "under_review"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "closed";

export type Priority = "critical" | "high" | "medium" | "low";

export interface StatusUpdate {
  status: ComplaintStatus;
  timestamp: string;
  note: string;
  updatedBy: string;
}

export interface Complaint {
  id: string;
  petitionId: string;
  title: string;
  description: string;
  category: string;
  location: string;
  district: string;
  submittedBy: string;
  submittedByName: string;
  submittedAt: string;
  status: ComplaintStatus;
  priority: Priority;
  assignedDepartment: string;
  assignedOfficer?: string;
  assignedOfficerName?: string;
  officerRemarks?: string;
  resolutionDetails?: string;
  resolutionProof?: string;
  aiAnalysis: AIAnalysis;
  statusHistory: StatusUpdate[];
  feedback?: {
    rating: number;
    comment: string;
    submittedAt: string;
  };
  images?: string[];
  isEscalated?: boolean;
  reopenCount: number;
  human_review_required?: boolean;
  review_reasons?: string[];
}

export interface Department {
  id: string;
  name: string;
  code: string;
  head: string;
  officerCount: number;
  pendingCount: number;
  resolvedCount: number;
  categories: string[];
}

export interface Officer {
  id: string;
  name: string;
  email: string;
  department: string;
  assignedCount: number;
  resolvedCount: number;
  rating: number;
  joinedAt: string;
}
