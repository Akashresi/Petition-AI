import { Clock, AlertTriangle, CheckCircle, Hourglass } from "lucide-react";
import { Complaint } from "@/types";
import { getSLAStatus, getSLAColor } from "@/lib/sla";
import { cn } from "@/lib/utils";

interface Props {
  complaint: Complaint;
  showDeadline?: boolean;
}

export default function SLABadge({ complaint, showDeadline = true }: Props) {
  const sla = getSLAStatus(complaint);
  const colorClass = getSLAColor(sla.isOverdue, sla.percentage);
  const pred = complaint.predictedResolution;

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <div className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border", colorClass)}>
        {complaint.status === "resolved" || complaint.status === "closed" ? (
          <CheckCircle className="w-3.5 h-3.5" />
        ) : sla.isOverdue ? (
          <AlertTriangle className="w-3.5 h-3.5" />
        ) : (
          <Clock className="w-3.5 h-3.5" />
        )}
        <span>{sla.label}</span>
        {showDeadline && (complaint.status !== "resolved" && complaint.status !== "closed") && (
          <span className="text-[10px] opacity-75">
            (Due: {new Date(sla.deadline).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })})
          </span>
        )}
      </div>

      {pred && complaint.status !== "resolved" && complaint.status !== "closed" && (
        <span
          title={pred.explanation}
          className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60"
        >
          <Hourglass className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          Est. {pred.confidenceInterval} ({Math.round(pred.confidence * 100)}% conf)
        </span>
      )}

      {pred?.backlogRisk && complaint.status !== "resolved" && complaint.status !== "closed" && (
        <span
          title={`Department backlog: ${pred.departmentPendingCount} pending complaints`}
          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border border-amber-300 dark:border-amber-800 animate-pulse"
        >
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          High Dept Backlog
        </span>
      )}
    </div>
  );
}
