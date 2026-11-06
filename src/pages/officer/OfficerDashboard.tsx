import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Search, Filter, CheckCircle, Clock, AlertTriangle, BarChart3, FileSpreadsheet, ArrowUpDown, Calendar } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useComplaints } from "@/hooks/useComplaints";
import { Link } from "react-router-dom";
import { cn, statusClass, statusLabel, priorityClass, formatDate } from "@/lib/utils";
import { ComplaintStatus, Priority } from "@/types";
import SLABadge from "@/components/features/SLABadge";
import { exportComplaintsToExcel } from "@/lib/excelExport";

const fadeInUp = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0 } },
};

export default function OfficerDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { complaints } = useComplaints();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");

  const deptComplaints = complaints.filter(c =>
    c.assignedDepartment === user?.department ||
    c.assignedOfficer === "o1"
  );

  const filtered = useMemo(() => deptComplaints.filter(c => {
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const matchPriority = priorityFilter === "all" || c.priority === priorityFilter;
    const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.petitionId.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchPriority && matchSearch;
  }), [deptComplaints, search, statusFilter, priorityFilter]);

  const pending = deptComplaints.filter(c => !["resolved", "closed"].includes(c.status));
  const resolved = deptComplaints.filter(c => ["resolved", "closed"].includes(c.status));
  const critical = deptComplaints.filter(c => c.priority === "critical");
  const overdue = deptComplaints.filter(c => {
    const SLA_DEADLINES: Record<string, number> = { critical: 24, high: 72, medium: 168, low: 336 };
    const deadlineMs = SLA_DEADLINES[c.priority] * 60 * 60 * 1000;
    const deadline = new Date(new Date(c.submittedAt).getTime() + deadlineMs);
    const remaining = deadline.getTime() - Date.now();
    const isResolved = c.status === "resolved" || c.status === "closed";
    return !isResolved && remaining < 0;
  });

  const stats = [
    { label: "Assigned", value: deptComplaints.length, icon: BarChart3, gradient: "from-navy-600 to-navy-700" },
    { label: "Pending", value: pending.length, icon: Clock, gradient: "from-amber-500 to-orange-500" },
    { label: "Resolved", value: resolved.length, icon: CheckCircle, gradient: "from-emerald-500 to-green-500" },
    { label: "Critical", value: critical.length, icon: AlertTriangle, gradient: "from-red-500 to-rose-500" },
    { label: "Overdue", value: overdue.length, icon: AlertTriangle, gradient: "from-orange-500 to-red-500" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
          <div>
            <h1 className="font-display text-3xl font-extrabold text-foreground">Officer Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {user?.name} · {user?.department || "Roads & Infrastructure"} Department
            </p>
          </div>
          <button onClick={() => exportComplaintsToExcel(filtered)}
            className="inline-flex items-center gap-2 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 px-4 py-2.5 rounded-full hover:bg-emerald-100 transition-all font-medium active:scale-[0.98]">
            <FileSpreadsheet className="w-4 h-4" /> Export to Excel
          </button>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-7"
        >
          {stats.map(s => (
            <motion.div key={s.label} variants={fadeInUp} className="group">
              <div className="card-doppelrand">
                <div className="card-doppelrand-inner">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center shadow-lg transition-transform duration-200`}>
                      <s.icon className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <p className="text-2xl font-display font-extrabold text-foreground">{s.value}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Task 6.7: Due Today / Overdue Triage Section */}
        {overdue.length > 0 && (
          <div className="mb-7 bg-red-50/80 dark:bg-red-950/30 border-2 border-red-300 dark:border-red-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <h2 className="text-base font-bold text-red-950 dark:text-red-100">
                  Priority Action Required: Due Today & Overdue ({overdue.length})
                </h2>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200">
                Breach Risk
              </span>
            </div>
            <p className="text-xs text-red-800/90 dark:text-red-200/90 mb-3">
              These petitions have breached SLA deadlines or are expiring today. Immediate action or departmental resolution required.
            </p>
            <div className="space-y-2">
              {overdue.map(c => {
                const SLA_DEADLINES: Record<string, number> = { critical: 24, high: 72, medium: 168, low: 336 };
                const deadlineMs = (SLA_DEADLINES[c.priority] || 168) * 60 * 60 * 1000;
                const deadline = new Date(new Date(c.submittedAt).getTime() + deadlineMs);
                const remainingHours = Math.round((deadline.getTime() - Date.now()) / (1000 * 60 * 60));
                const isOverdue = remainingHours < 0;

                return (
                  <Link
                    key={c.id}
                    to={`/officer/petition/${c.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/60 rounded-xl hover:border-red-400 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-xs font-bold text-red-700 dark:text-red-400">
                          {c.petitionId}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs font-medium text-foreground truncate">{c.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{c.location} · {formatDate(c.submittedAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                        isOverdue
                          ? "bg-red-600 text-white"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                      }`}>
                        {isOverdue ? (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Overdue by {Math.abs(remainingHours)}h
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5" />
                            Due in {remainingHours}h
                          </>
                        )}
                      </span>
                      <span className="text-xs font-semibold px-2 py-1 rounded border bg-card text-foreground">
                        {c.priority.toUpperCase()}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="card-doppelrand mb-6"
        >
          <div className="card-doppelrand-inner">
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search complaints..."
                className="w-full bg-muted/50 dark:bg-muted/20 border border-border rounded-2xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 dark:focus:ring-gold-400 text-foreground transition-all" />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex items-center gap-1.5 mr-1">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              {(["all", "submitted", "under_review", "assigned", "in_progress"] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={cn("text-xs px-3.5 py-1.5 rounded-full border font-medium transition-all duration-200",
                    statusFilter === s ? "bg-navy-800 dark:bg-gold-500 text-white dark:text-navy-950 border-navy-800 dark:border-gold-500 shadow-sm" : "bg-card text-muted-foreground border-border hover:border-navy-300 dark:hover:border-gold-400/50 hover:text-foreground")}>
                  {s === "all" ? "All" : statusLabel(s)}
                </button>
              ))}
              <span className="mx-1 text-border">|</span>
              {(["all", "critical", "high", "medium", "low"] as const).map(p => (
                <button key={p} onClick={() => setPriorityFilter(p)}
                  className={cn("text-xs px-3.5 py-1.5 rounded-full border font-medium capitalize transition-all duration-200",
                    priorityFilter === p ? "bg-navy-800 dark:bg-gold-500 text-white dark:text-navy-950 border-navy-800 dark:border-gold-500 shadow-sm" : "bg-card text-muted-foreground border-border hover:border-navy-300 dark:hover:border-gold-400/50 hover:text-foreground")}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Complaints Table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="card-doppelrand overflow-hidden"
        >
          <div className="card-doppelrand-inner !p-0 overflow-hidden">
            <div className="bg-gradient-to-r from-navy-800 to-navy-900 text-white px-6 py-4 flex items-center justify-between">
              <span className="font-display font-bold text-sm">Assigned Complaints ({filtered.length})</span>
              <span className="text-navy-300 text-xs">Click a row to manage</span>
            </div>
            <div className="divide-y divide-border">
              {filtered.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">No complaints match your filters.</div>
              ) : (
                filtered.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: i * 0.03 }}
                  >
                    <Link to={`/officer/petition/${c.id}`}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-6 py-4 hover:bg-muted/50 transition-colors group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-mono font-semibold text-navy-600 dark:text-gold-400">{c.petitionId}</span>
                          {c.aiAnalysis.isDuplicate && <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 rounded-full font-semibold">DUPLICATE</span>}
                          {c.isEscalated && <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 px-2 py-0.5 rounded-full font-semibold">ESCALATED</span>}
                        </div>
                        <p className="text-sm font-semibold text-foreground group-hover:text-navy-700 dark:group-hover:text-navy-300 transition-colors">{c.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.submittedByName} · {c.location} · {formatDate(c.submittedAt)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <SLABadge complaint={c} showDeadline={false} />
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-navy-50 text-navy-700 border border-navy-200/60 dark:bg-navy-900/60 dark:text-navy-200 dark:border-navy-700/60">
                          {Math.round(c.aiAnalysis.categoryConfidence * 100)}% AI
                        </span>
                        <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border", priorityClass(c.priority))}>{c.priority.toUpperCase()}</span>
                        <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border", statusClass(c.status))}>{statusLabel(c.status)}</span>
                      </div>
                    </Link>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
