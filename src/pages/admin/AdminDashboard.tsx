import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Users, FileText, CheckCircle, AlertTriangle, Building2, TrendingUp, ArrowRight, Clock, Shield, ShieldAlert } from "lucide-react";
import { useComplaints } from "@/hooks/useComplaints";
import { DEPARTMENTS, OFFICERS } from "@/constants/mockData";
import { ANALYTICS_DATA } from "@/constants/mockData";
import { cn, statusClass, statusLabel, priorityClass, formatDate } from "@/lib/utils";
import ComplaintMap from "@/components/features/ComplaintMap";

const fadeInUp = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0 } },
};

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { complaints } = useComplaints();
  const critical = complaints.filter(c => c.priority === "critical" && c.status !== "resolved");
  const pending = complaints.filter(c => !["resolved", "closed"].includes(c.status));
  const resolved = complaints.filter(c => ["resolved", "closed"].includes(c.status));

  const stats = [
    { label: "Total Complaints", value: ANALYTICS_DATA.totalComplaints, icon: FileText, gradient: "from-navy-600 to-navy-700", sub: "All time" },
    { label: "Pending", value: pending.length, icon: Clock, gradient: "from-amber-500 to-orange-500", sub: "Needs attention" },
    { label: "Resolved", value: ANALYTICS_DATA.resolvedComplaints, icon: CheckCircle, gradient: "from-emerald-500 to-green-500", sub: "This month" },
    { label: "Critical", value: ANALYTICS_DATA.criticalComplaints, icon: AlertTriangle, gradient: "from-red-500 to-rose-500", sub: "Urgent" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="font-display text-3xl font-extrabold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">System overview and complaint management</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/admin/reviews" className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-sm">
              <ShieldAlert className="w-4 h-4" /> Review Queue
            </Link>
            <Link to="/admin/complaints" className="btn-primary text-sm flex items-center gap-2">
              <FileText className="w-4 h-4" /> All Complaints
            </Link>
            <Link to="/admin/analytics" className="btn-secondary text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Analytics
            </Link>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          {stats.map(s => (
            <motion.div key={s.label} variants={fadeInUp} className="group">
              <div className="card-doppelrand">
                <div className="card-doppelrand-inner">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-muted-foreground font-medium">{s.label}</p>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center shadow-lg transition-transform duration-200`}>
                      <s.icon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <p className="text-3xl font-display font-extrabold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Map */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="mb-8"
        >
          <ComplaintMap complaints={complaints} height="350px" />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Critical Complaints */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2 card-doppelrand overflow-hidden"
          >
            <div className="card-doppelrand-inner !p-0 overflow-hidden">
              <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-display font-bold text-sm">Critical Complaints</span>
                </div>
                <Link to="/admin/complaints" className="text-red-200 hover:text-white text-xs flex items-center gap-1 font-medium">View all <ArrowRight className="w-3 h-3" /></Link>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {critical.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No critical complaints.</div>
                ) : (
                  critical.slice(0, 5).map((c, i) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: i * 0.03 }}
                    >
                      <Link to={`/admin/complaint/${c.id}`} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-all">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{c.title}</p>
                          <p className="text-xs text-muted-foreground">{c.petitionId} · {c.assignedDepartment}</p>
                        </div>
                        <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border", statusClass(c.status))}>{statusLabel(c.status)}</span>
                      </Link>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </motion.div>

          {/* Department Overview */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="card-doppelrand overflow-hidden"
          >
            <div className="card-doppelrand-inner !p-0 overflow-hidden">
              <div className="bg-gradient-to-r from-navy-800 to-navy-900 text-white px-6 py-4 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span className="font-display font-bold text-sm">Departments</span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {DEPARTMENTS.slice(0, 5).map(d => (
                  <div key={d.id} className="px-5 py-3.5">
                    <div className="flex justify-between items-center mb-1.5">
                      <p className="text-xs font-semibold text-foreground truncate">{d.name}</p>
                      <span className="text-xs font-bold text-navy-700 dark:text-navy-300">{d.code}</span>
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span className="text-amber-600 font-medium">{d.pendingCount} pending</span>
                      <span className="text-emerald-600 font-medium">{d.resolvedCount} resolved</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Officers + Recent */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Officers */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="card-doppelrand overflow-hidden"
          >
            <div className="card-doppelrand-inner !p-0 overflow-hidden">
              <div className="bg-gradient-to-r from-navy-800 to-navy-900 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span className="font-display font-bold text-sm">Officers</span>
                </div>
                <Link to="/admin/users" className="text-navy-300 hover:text-white text-xs flex items-center gap-1 font-medium">Manage <ArrowRight className="w-3 h-3" /></Link>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {OFFICERS.map(o => (
                  <div key={o.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="w-9 h-9 bg-gradient-to-br from-navy-100 to-navy-200 rounded-xl flex items-center justify-center text-navy-700 font-bold text-sm flex-shrink-0">
                      {o.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{o.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{o.department}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-navy-700 dark:text-navy-300">{o.assignedCount} active</p>
                      <p className="text-[10px] text-muted-foreground">{o.resolvedCount} resolved</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Recent Complaints */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="card-doppelrand overflow-hidden"
          >
            <div className="card-doppelrand-inner !p-0 overflow-hidden">
              <div className="bg-gradient-to-r from-navy-800 to-navy-900 text-white px-6 py-4 flex items-center justify-between">
                <span className="font-display font-bold text-sm">Recent Petitions</span>
                <Link to="/admin/complaints" className="text-navy-300 hover:text-white text-xs flex items-center gap-1 font-medium">All <ArrowRight className="w-3 h-3" /></Link>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {complaints.slice(0, 5).map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: i * 0.03 }}
                  >
                    <Link to={`/admin/complaint/${c.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-all">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-muted-foreground">{c.petitionId}</span>
                          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border", priorityClass(c.priority))}>{c.priority}</span>
                        </div>
                      </div>
                      <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border ml-2 flex-shrink-0", statusClass(c.status))}>{statusLabel(c.status)}</span>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
