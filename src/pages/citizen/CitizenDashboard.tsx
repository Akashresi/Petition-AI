import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  PlusCircle,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  MapPin,
  Building2,
  Calendar,
  Bell,
  User,
  Activity,
  Search,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useComplaints } from "@/hooks/useComplaints";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDate } from "@/lib/utils";
import FirstLaunchLanguageModal from "@/components/features/FirstLaunchLanguageModal";

export default function CitizenDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { complaints, getByUser } = useComplaints();
  const { notifications } = useNotifications(user?.id);

  const myComplaints = getByUser(user?.id || "u1");
  const recentComplaints = myComplaints.slice(0, 5);

  const totalCount = myComplaints.length;
  const pendingCount = myComplaints.filter(c => !["resolved", "closed"].includes(c.status)).length;
  const resolvedCount = myComplaints.filter(c => ["resolved", "closed"].includes(c.status)).length;
  const criticalCount = myComplaints.filter(c => c.priority === "critical").length;

  const firstName = user?.name ? user.name.split(" ")[0] : "Citizen";

  return (
    <div className="min-h-screen bg-navy-975 text-foreground py-8 px-4 sm:px-6 lg:px-8">
      <FirstLaunchLanguageModal />

      <main className="max-w-7xl mx-auto space-y-8">
        {/* ── Top Welcome Bar & Primary CTA ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-white tracking-tight">
              Welcome back, {firstName}
            </h1>
            <p className="text-slate-400 text-sm sm:text-base mt-1">
              Track your petitions and submit new grievances
            </p>
          </div>
          <Link
            to="/citizen/submit"
            className="btn-gold self-start sm:self-auto min-h-[48px] px-6 text-sm sm:text-base"
          >
            <PlusCircle className="w-5 h-5 shrink-0" />
            <span>Submit New Petition</span>
          </Link>
        </div>

        {/* ── 4 Stat Cards Row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total */}
          <div className="card-reference p-5 sm:p-6 bg-surface-card border-surface-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs sm:text-sm font-medium text-slate-400">Total Petitions</span>
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/30">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl sm:text-4xl font-display font-extrabold text-white">{totalCount}</p>
          </div>

          {/* Pending */}
          <div className="card-reference p-5 sm:p-6 bg-surface-card border-surface-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs sm:text-sm font-medium text-slate-400">Pending</span>
              <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-navy-950 shadow-md shadow-amber-500/30">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl sm:text-4xl font-display font-extrabold text-white">{pendingCount}</p>
          </div>

          {/* Resolved */}
          <div className="card-reference p-5 sm:p-6 bg-surface-card border-surface-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs sm:text-sm font-medium text-slate-400">Resolved</span>
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/30">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl sm:text-4xl font-display font-extrabold text-white">{resolvedCount}</p>
          </div>

          {/* Critical */}
          <div className="card-reference p-5 sm:p-6 bg-surface-card border-surface-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs sm:text-sm font-medium text-slate-400">Critical</span>
              <div className="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center text-white shadow-md shadow-rose-500/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl sm:text-4xl font-display font-extrabold text-white">{criticalCount}</p>
          </div>
        </div>

        {/* ── Main Content 2-Column Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column (2 cols wide): Recent Petitions */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg sm:text-xl font-display font-bold text-white">Recent Petitions</h2>
              <Link
                to="/citizen/petitions"
                className="text-gold-400 hover:text-gold-300 text-xs sm:text-sm font-semibold flex items-center gap-1 transition-colors"
              >
                <span>View all</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {recentComplaints.length === 0 ? (
              <div className="card-reference p-8 text-center bg-surface-card border-surface-border">
                <FileText className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-300 font-medium">No petitions submitted yet.</p>
                <p className="text-slate-500 text-xs mt-1">Submit your first petition in voice or text.</p>
              </div>
            ) : (
              recentComplaints.map(c => {
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

                return (
                  <Link
                    key={c.id}
                    to={`/citizen/petition/${c.id}`}
                    className="card-reference p-5 sm:p-6 block bg-surface-card border-surface-border hover:border-surface-borderActive/70 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-gold-400 bg-gold-400/10 px-2 py-0.5 rounded border border-gold-400/30">
                          {c.petitionId}
                        </span>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
                            statusStyles[c.status] || "bg-slate-800 text-slate-300 border-slate-700"
                          }`}
                        >
                          {statusLabels[c.status] || c.status}
                        </span>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full border font-bold uppercase ${
                            priorityStyles[c.priority] || "bg-slate-800 text-slate-300 border-slate-700"
                          }`}
                        >
                          {c.priority}
                        </span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-gold-400 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                    </div>

                    <h3 className="text-base sm:text-lg font-display font-bold text-white group-hover:text-gold-300 transition-colors mb-1.5">
                      {c.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 line-clamp-2 leading-relaxed mb-3">
                      {c.description}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap mb-3.5 pt-2 border-t border-surface-border/60">
                      {c.location && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          <span>{c.location}</span>
                        </span>
                      )}
                      {c.assignedDepartment && (
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>{c.assignedDepartment}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>{formatDate(c.submittedAt)}</span>
                      </span>
                    </div>

                    {/* AI Info Bar */}
                    {c.aiAnalysis && (
                      <div className="bg-navy-950/70 border border-navy-800/80 rounded-xl px-3.5 py-2 flex items-center justify-between text-xs text-slate-300 flex-wrap gap-2">
                        <span>
                          <strong className="text-blue-400">AI:</strong> {c.aiAnalysis.category}
                        </span>
                        <span>
                          <strong className="text-slate-400">Confidence:</strong>{" "}
                          <span className="text-emerald-400 font-semibold">
                            {Math.round(c.aiAnalysis.categoryConfidence * 100)}%
                          </span>
                        </span>
                        <span className="capitalize">
                          <strong className="text-slate-400">Sentiment:</strong>{" "}
                          <span className="text-amber-300">{c.aiAnalysis.sentiment}</span>
                        </span>
                      </div>
                    )}
                  </Link>
                );
              })
            )}
          </div>

          {/* Right Column (1 col wide): Quick Actions & Notifications */}
          <div className="space-y-6">
            {/* Quick Actions Card */}
            <div className="card-reference p-6 bg-surface-card border-surface-border space-y-4">
              <h3 className="font-display font-bold text-base sm:text-lg text-white">Quick Actions</h3>
              <div className="space-y-2">
                <Link
                  to="/citizen/submit"
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface-cardLighter/50 hover:bg-surface-cardLighter text-slate-200 hover:text-white transition-colors border border-surface-border/60 group"
                >
                  <PlusCircle className="w-5 h-5 text-blue-400 group-hover:text-gold-400 transition-colors" />
                  <span className="text-sm font-semibold">Submit New Petition</span>
                </Link>
                <Link
                  to="/citizen/petitions"
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface-cardLighter/50 hover:bg-surface-cardLighter text-slate-200 hover:text-white transition-colors border border-surface-border/60 group"
                >
                  <FileText className="w-5 h-5 text-blue-400 group-hover:text-gold-400 transition-colors" />
                  <span className="text-sm font-semibold">My Petitions</span>
                </Link>
                <Link
                  to="/citizen/profile"
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface-cardLighter/50 hover:bg-surface-cardLighter text-slate-200 hover:text-white transition-colors border border-surface-border/60 group"
                >
                  <User className="w-5 h-5 text-blue-400 group-hover:text-gold-400 transition-colors" />
                  <span className="text-sm font-semibold">My Profile</span>
                </Link>
                <Link
                  to="/citizen/track"
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface-cardLighter/50 hover:bg-surface-cardLighter text-slate-200 hover:text-white transition-colors border border-surface-border/60 group"
                >
                  <Search className="w-5 h-5 text-blue-400 group-hover:text-gold-400 transition-colors" />
                  <span className="text-sm font-semibold">Track Petition by ID</span>
                </Link>
              </div>
            </div>

            {/* Notifications Card */}
            <div className="card-reference p-6 bg-surface-card border-surface-border space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-gold-400" />
                  <h3 className="font-display font-bold text-base text-white">Notifications</h3>
                </div>
                <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
                  {notifications.filter(n => !n.isRead).length || 1}
                </span>
              </div>

              <div className="space-y-3">
                {notifications.length > 0 ? (
                  notifications.slice(0, 3).map(n => (
                    <div
                      key={n.id}
                      className="p-3.5 rounded-xl bg-navy-950/60 border border-navy-800/80 space-y-1"
                    >
                      <p className="text-xs font-bold text-white">{n.title}</p>
                      <p className="text-xs text-slate-400 leading-relaxed">{n.message}</p>
                    </div>
                  ))
                ) : (
                  <div className="p-3.5 rounded-xl bg-navy-950/60 border border-navy-800/80 space-y-1">
                    <p className="text-xs font-bold text-white">Petition Submitted</p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Your petition PET-2024-001 has been submitted and AI analysis is complete.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
