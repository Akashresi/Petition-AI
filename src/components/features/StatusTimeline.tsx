import { CheckCircle, Clock, Circle } from "lucide-react";
import { ComplaintStatus, StatusUpdate } from "@/types";
import { formatDateTime, statusLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATUS_ORDER: ComplaintStatus[] = [
  "submitted",
  "under_review",
  "assigned",
  "in_progress",
  "resolved",
  "closed",
];

const STATUS_COLORS: Record<ComplaintStatus, string> = {
  submitted: "bg-blue-500",
  under_review: "bg-yellow-500",
  assigned: "bg-purple-500",
  in_progress: "bg-orange-500",
  resolved: "bg-green-500",
  closed: "bg-gray-500",
};

interface Props {
  currentStatus: ComplaintStatus;
  history: StatusUpdate[];
}

export default function StatusTimeline({ currentStatus, history }: Props) {
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);

  return (
    <div className="card-reference p-5 sm:p-6 bg-surface-card border-surface-border">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <Clock className="w-4 h-4 text-navy-600 dark:text-navy-300" />
        Complaint Status Timeline
      </h3>

      {/* Step indicators */}
      <div className="relative flex items-center justify-between mb-6">
        {STATUS_ORDER.map((s, i) => {
          const done = i <= currentIdx;
          const active = i === currentIdx;
          return (
            <div key={s} className="flex flex-col items-center relative z-10" style={{ flex: 1 }}>
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all",
                done ? `${STATUS_COLORS[s]} border-transparent` : "bg-card border-border",
                active ? "ring-2 ring-offset-2 ring-navy-400" : ""
              )}>
                {done
                  ? <CheckCircle className="w-4 h-4 text-white" />
                  : <Circle className="w-3 h-3 text-muted-foreground" />
                }
              </div>
              <p className={cn(
                "text-[9px] mt-1.5 font-medium text-center leading-tight",
                done ? "text-navy-700 dark:text-navy-300" : "text-muted-foreground dark:text-muted-foreground"
              )}>
                {statusLabel(s).replace(" ", "\n")}
              </p>
              {/* Connector */}
              {i < STATUS_ORDER.length - 1 && (
                <div className={cn(
                  "absolute top-3.5 left-1/2 w-full h-0.5",
                  i < currentIdx ? "bg-navy-500" : "bg-border"
                )} style={{ transform: "translateY(-50%)", zIndex: -1 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* History log */}
      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Activity Log</p>
        {history.map((h, i) => (
          <div key={i} className="flex gap-3">
            <div className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0", STATUS_COLORS[h.status])} />
            <div>
              <p className="text-xs font-medium text-foreground">{statusLabel(h.status)}</p>
              <p className="text-[11px] text-muted-foreground">{h.note}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{formatDateTime(h.timestamp)} · {h.updatedBy}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
