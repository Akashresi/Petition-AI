import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertTriangle,
  BarChart3,
  FileSpreadsheet,
  ChevronRight,
  MapPin,
  Calendar,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useComplaints } from "@/hooks/useComplaints";
import { cn, formatDate } from "@/lib/utils";
import { ComplaintStatus, Priority } from "@/types";
import SLABadge from "@/components/features/SLABadge";
import { exportComplaintsToExcel } from "@/lib/excelExport";
import { toast } from "sonner";

const fadeInUp = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0 } },
};

const STATUS_OPTIONS: { value: ComplaintStatus; label: string }[] = [
  { value: "under_review", label: "Under Review" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export default function OfficerDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { complaints, updateComplaint } = useComplaints();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");

  const deptComplaints = complaints.filter(
    (c) =>
      c.assignedDepartment === user?.department ||
      c.assignedOfficer === "o1" ||
      !c.assignedDepartment ||
      c.assignedDepartment === "Roads & Infrastructure"
  );

  const filtered = useMemo(() => {
    return deptComplaints.filter((c) => {
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      const matchPriority = priorityFilter === "all" || c.priority === priorityFilter;
      const matchSearch =
        !search ||
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.petitionId.toLowerCase().includes(search.toLowerCase()) ||
        (c.submittedByName && c.submittedByName.toLowerCase().includes(search.toLowerCase()));
      return matchStatus && matchPriority && matchSearch;
    });
  }, [deptComplaints, search, statusFilter, priorityFilter]);

  const pending = deptComplaints.filter((c) => !["resolved", "closed"].includes(c.status));
  const resolved = deptComplaints.filter((c) => ["resolved", "closed"].includes(c.status));
  const critical = deptComplaints.filter((c) => c.priority === "critical");
  const overdue = deptComplaints.filter((c) => {
    const SLA_DEADLINES: Record<string, number> = { critical: 24, high: 72, medium: 168, low: 336 };
    const deadlineMs = (SLA_DEADLINES[c.priority] || 168) * 60 * 60 * 1000;
    const deadline = new Date(new Date(c.submittedAt).getTime() + deadlineMs);
    const remaining = deadline.getTime() - Date.now();
    const isResolved = c.status === "resolved" || c.status === "closed";
    return !isResolved && remaining < 0;
  });

  const stats = [
    { label: "Assigned", value: deptComplaints.length, icon: BarChart3, iconBg: "bg-blue-600 text-white" },
    { label: "Pending", value: pending.length, icon: Clock, iconBg: "bg-amber-500 text-navy-950" },
    { label: "Resolved", value: resolved.length, icon: CheckCircle, iconBg: "bg-emerald-500 text-white" },
    { label: "Critical", value: critical.length, icon: AlertTriangle, iconBg: "bg-rose-500 text-white" },
    { label: "Overdue", value: overdue.length, icon: AlertTriangle, iconBg: "bg-orange-500 text-white" },
  ];

  const handleInlineStatusChange = (complaintId: string, newStatus: ComplaintStatus) => {
    updateComplaint(complaintId, {
      status: newStatus,
      statusHistory: [
        ...(complaints.find((c) => c.id === complaintId)?.statusHistory || []),
        {
          status: newStatus,
          timestamp: new Date().toISOString(),
          note: `Status updated to ${newStatus.replace("_", " ")} by officer`,
          updatedBy: user?.name || "Officer",
        },
      ],
    });
    toast.success(`Petition status updated to ${newStatus.replace("_", " ")}`);
  };

  return (
    <div className="min-h-screen bg-navy-975 text-foreground py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-7">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Officer Dashboard
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {user?.name || "Priya Suresh"} · {user?.department || "Roads & Infrastructure"} Department
            </p>
          </div>
          <button
            type="button"
            onClick={() => exportComplaintsToExcel(filtered)}
            className="inline-flex items-center gap-2 text-xs sm:text-sm bg-emerald-950/40 text-emerald-300 border border-emerald-600/70 px-4 py-2.5 rounded-full hover:bg-emerald-900/50 transition-all font-semibold active:scale-[0.98] self-start sm:self-auto"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export to Excel</span>
          </button>
        </div>

        {/* 5 Stats Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="card-reference p-5 sm:p-6 bg-surface-card border-surface-border flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs sm:text-sm font-medium text-slate-400">{s.label}</span>
                <div
                  className={`w-9 h-9 rounded-xl ${s.iconBg} flex items-center justify-center shadow-md`}
                >
                  <s.icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl sm:text-4xl font-display font-extrabold text-white">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Overdue Alert Banner if breaches exist */}
        {overdue.length > 0 && (
          <div className="rounded-2xl border border-red-700/60 bg-red-950/30 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-300 font-bold text-sm sm:text-base">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <span>Priority Action Required: Due Today & Overdue ({overdue.length})</span>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-900/60 text-red-200 border border-red-700/60">
                Breach Risk
              </span>
            </div>
            <p className="text-xs text-red-200/90 leading-relaxed">
              These petitions have breached SLA deadlines or are expiring today. Immediate action or departmental resolution required.
            </p>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="card-reference p-5 sm:p-6 bg-surface-card border-surface-border space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search complaints..."
              className="w-full bg-surface-input border border-surface-border rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition-all font-medium"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center text-xs">
            <div className="flex items-center gap-1.5 mr-1 text-slate-400">
              <Filter className="w-3.5 h-3.5" />
            </div>

            {/* Status Pills */}
            {(["all", "submitted", "under_review", "assigned", "in_progress"] as const).map((s) => {
              const isActive = statusFilter === s;
              const labels: Record<string, string> = {
                all: "All",
                submitted: "Submitted",
                under_review: "Under Review",
                assigned: "Assigned",
                in_progress: "In Progress",
              };
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "filter-pill",
                    isActive ? "filter-pill-active" : "filter-pill-inactive"
                  )}
                >
                  {labels[s]}
                </button>
              );
            })}

            <span className="mx-1 text-slate-700">|</span>

            {/* Priority Pills */}
            {(["all", "critical", "high", "medium", "low"] as const).map((p) => {
              const isActive = priorityFilter === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriorityFilter(p)}
                  className={cn(
                    "filter-pill capitalize",
                    isActive ? "filter-pill-active" : "filter-pill-inactive"
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Assigned Complaints Table Card */}
        <div className="card-reference bg-surface-card border-surface-border overflow-hidden">
          {/* Royal Blue Title Header Bar */}
          <div className="card-header-bar">
            <span className="font-display font-bold text-sm sm:text-base">
              Assigned Complaints ({filtered.length})
            </span>
            <span className="text-slate-300 text-xs hidden sm:inline">
              Priority queue with direct status update control
            </span>
          </div>

          {/* Complaints Rows */}
          <div className="divide-y divide-surface-border">
            {filtered.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                No complaints match your filters.
              </div>
            ) : (
              filtered.map((c) => {
                const isOverdue =
                  c.status !== "resolved" &&
                  c.status !== "closed" &&
                  new Date(c.submittedAt).getTime() + 24 * 3600 * 1000 < Date.now();

                return (
                  <div
                    key={c.id}
                    className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 sm:p-6 hover:bg-surface-cardLighter/40 transition-colors group"
                  >
                    {/* Left Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs font-mono font-bold text-gold-400 bg-gold-400/10 px-2 py-0.5 rounded border border-gold-400/30">
                          {c.petitionId}
                        </span>
                        {c.aiAnalysis.isDuplicate && (
                          <span className="text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-600/70 px-2 py-0.5 rounded-full uppercase">
                            DUPLICATE
                          </span>
                        )}
                        {c.isEscalated && (
                          <span className="text-[10px] font-bold bg-red-950/60 text-red-300 border border-red-600/70 px-2 py-0.5 rounded-full uppercase">
                            ESCALATED
                          </span>
                        )}
                      </div>

                      <Link
                        to={`/officer/petition/${c.id}`}
                        className="text-base font-display font-bold text-white group-hover:text-gold-300 transition-colors block mb-1"
                      >
                        {c.title}
                      </Link>

                      <p className="text-xs text-slate-400">
                        {c.submittedByName} · {c.location} · {formatDate(c.submittedAt)}
                      </p>
                    </div>

                    {/* Right Action Controls */}
                    <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                      {/* SLA Badge */}
                      <SLABadge complaint={c} showDeadline={false} />

                      {/* AI Confidence */}
                      <span className="badge-ai text-xs">
                        {Math.round(c.aiAnalysis.categoryConfidence * 100)}% AI
                      </span>

                      {/* Priority Badge */}
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full border font-bold uppercase ${
                          c.priority === "critical"
                            ? "bg-red-950/60 text-red-400 border-red-700/60"
                            : c.priority === "high"
                            ? "bg-orange-950/60 text-orange-400 border-orange-700/60"
                            : "bg-amber-950/60 text-amber-300 border-amber-700/60"
                        }`}
                      >
                        {c.priority}
                      </span>

                      {/* Inline Status Dropdown */}
                      <div className="flex items-center gap-1.5 bg-surface-input border border-surface-border rounded-xl px-2.5 py-1 text-xs">
                        <span className="text-slate-400 font-semibold uppercase text-[10px]">Status:</span>
                        <select
                          value={c.status}
                          onChange={(e) => handleInlineStatusChange(c.id, e.target.value as ComplaintStatus)}
                          className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer pr-1"
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value} className="bg-navy-900 text-white">
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Details Link */}
                      <Link
                        to={`/officer/petition/${c.id}`}
                        className="text-xs text-gold-400 hover:text-gold-300 font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-gold-500/10 transition-colors shrink-0"
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
