import { Link } from "react-router-dom";
import { MapPin, Calendar, Building2, ChevronRight, Copy } from "lucide-react";
import { Complaint } from "@/types";
import { cn, priorityClass, formatDate } from "@/lib/utils";

interface Props {
  complaint: Complaint;
  linkTo?: string;
  showAI?: boolean;
}

export default function ComplaintCard({ complaint, linkTo, showAI = true }: Props) {
  const priorityStyles: Record<string, string> = {
    critical: "bg-red-950/60 text-red-400 border-red-700/60",
    high: "bg-orange-950/60 text-orange-400 border-orange-700/60",
    medium: "bg-amber-950/60 text-amber-300 border-amber-700/60",
    low: "bg-emerald-950/60 text-emerald-300 border-emerald-700/60",
  };

  const statusStyles: Record<string, string> = {
    submitted: "bg-blue-950/50 text-blue-300 border-blue-700/60",
    under_review: "bg-amber-950/50 text-amber-300 border-amber-600/60",
    assigned: "bg-purple-950/50 text-purple-300 border-purple-700/60",
    in_progress: "bg-orange-950/50 text-orange-300 border-orange-600/60",
    resolved: "bg-emerald-950/50 text-emerald-300 border-emerald-600/60",
    closed: "bg-slate-800 text-slate-400 border-slate-700",
  };

  const statusLabels: Record<string, string> = {
    submitted: "Submitted",
    under_review: "Under Review",
    assigned: "Assigned",
    in_progress: "In Progress",
    resolved: "Resolved",
    closed: "Closed",
  };

  const cardContent = (
    <div className="card-reference p-5 bg-surface-card border-surface-border hover:border-surface-borderActive/70 transition-all group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-mono font-bold text-gold-400 bg-gold-400/10 px-2 py-0.5 rounded border border-gold-400/30">
              {complaint.petitionId}
            </span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
                statusStyles[complaint.status] || "bg-slate-800 text-slate-300 border-slate-700"
              }`}
            >
              {statusLabels[complaint.status] || complaint.status}
            </span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full border font-bold uppercase ${
                priorityStyles[complaint.priority] || "bg-slate-800 text-slate-300 border-slate-700"
              }`}
            >
              {complaint.priority}
            </span>
            {complaint.aiAnalysis.isDuplicate && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-amber-950/40 text-amber-300 border-amber-600/60 flex items-center gap-1">
                <Copy className="w-3 h-3" /> Duplicate
              </span>
            )}
          </div>
          <h3 className="text-base font-display font-bold text-white group-hover:text-gold-300 transition-colors leading-snug mb-1.5">
            {complaint.title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 line-clamp-2 mb-3 leading-relaxed">
            {complaint.description}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 pt-2 border-t border-surface-border/60">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-500" /> {complaint.location}
            </span>
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-500" /> {complaint.assignedDepartment}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" /> {formatDate(complaint.submittedAt)}
            </span>
          </div>
        </div>
        {linkTo && (
          <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-gold-400 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
        )}
      </div>

      {showAI && complaint.aiAnalysis && (
        <div className="mt-3.5 pt-2.5 border-t border-surface-border/60 flex items-center justify-between text-xs text-slate-300 flex-wrap gap-2 bg-navy-950/60 -mx-5 -mb-5 px-5 py-2.5 rounded-b-2xl">
          <span>
            <strong className="text-blue-400">AI:</strong> {complaint.category}
          </span>
          <span>
            <strong className="text-slate-400">Confidence:</strong>{" "}
            <span className="text-emerald-400 font-semibold">
              {Math.round(complaint.aiAnalysis.categoryConfidence * 100)}%
            </span>
          </span>
          <span className="capitalize">
            <strong className="text-slate-400">Sentiment:</strong>{" "}
            <span className="text-amber-300">{complaint.aiAnalysis.sentiment}</span>
          </span>
        </div>
      )}
    </div>
  );

  if (linkTo) {
    return <Link to={linkTo} className="block">{cardContent}</Link>;
  }
  return cardContent;
}
