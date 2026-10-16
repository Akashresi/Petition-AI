import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { Search, Filter, PlusCircle, FileText, SlidersHorizontal, X, Calendar, ArrowUpDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useComplaints } from "@/hooks/useComplaints";
import ComplaintCard from "@/components/features/ComplaintCard";
import { ComplaintStatus, Priority } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_FILTERS: { label: string; value: ComplaintStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Submitted", value: "submitted" },
  { label: "Under Review", value: "under_review" },
  { label: "Assigned", value: "assigned" },
  { label: "In Progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];

const PRIORITY_FILTERS: { label: string; value: Priority | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];

const fadeInUp = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.03, delayChildren: 0 } },
};

export default function MyPetitions() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { getByUser } = useComplaints();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "priority">("date");
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  const complaints = getByUser(user?.id || "u1");

  const filtered = useMemo(() => {
    const result = complaints.filter(c => {
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      const matchPriority = priorityFilter === "all" || c.priority === priorityFilter;
      const matchSearch = !search ||
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.petitionId.toLowerCase().includes(search.toLowerCase()) ||
        c.category.toLowerCase().includes(search.toLowerCase()) ||
        c.description.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchPriority && matchSearch;
    });

    if (sortBy === "priority") {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      result.sort((a, b) => order[a.priority] - order[b.priority]);
    } else {
      result.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    }

    return result;
  }, [complaints, search, statusFilter, priorityFilter, sortBy]);

  const activeFilters = [statusFilter !== "all", priorityFilter !== "all"].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="font-display text-3xl font-extrabold text-foreground">{t("nav.myPetitions")}</h1>
            <p className="text-muted-foreground text-sm mt-1">{complaints.length} total petitions filed</p>
          </div>
          <Link to="/citizen/submit" className="btn-primary flex items-center gap-2 w-fit text-sm">
            <PlusCircle className="w-4 h-4" /> {t("nav.submitPetition")}
          </Link>
        </motion.div>

        {/* Search & Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-doppelrand mb-6"
        >
          <div className="card-doppelrand-inner">
            {/* Search Bar */}
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by title, petition ID, category, or description..."
                className="w-full bg-muted/50 dark:bg-muted/20 border border-border rounded-2xl pl-11 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 dark:focus:ring-gold-400 text-foreground transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filters */}
            <div className="flex flex-wrap gap-2 mb-3">
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={cn(
                    "text-xs px-3.5 py-1.5 rounded-full border font-medium transition-all duration-200",
                    statusFilter === f.value
                      ? "bg-navy-800 dark:bg-gold-500 text-white dark:text-navy-950 border-navy-800 dark:border-gold-500 shadow-sm"
                      : "bg-card text-muted-foreground border-border hover:border-navy-300 dark:hover:border-gold-400/50 hover:text-foreground"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Advanced Filters Toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-xs font-medium text-navy-600 dark:text-gold-400 hover:text-navy-800 dark:hover:text-gold-300 transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Advanced Filters
              {activeFilters > 0 && (
                <span className="bg-navy-100 dark:bg-navy-800 text-navy-700 dark:text-gold-300 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {activeFilters}
                </span>
              )}
            </button>

            {/* Advanced Filters */}
            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 mt-4 border-t border-border space-y-4">
                    {/* Priority Filter */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Priority</label>
                      <div className="flex flex-wrap gap-2">
                        {PRIORITY_FILTERS.map(f => (
                          <button
                            key={f.value}
                            type="button"
                            onClick={() => setPriorityFilter(f.value)}
                            className={cn(
                              "text-xs px-3.5 py-1.5 rounded-full border font-medium transition-all duration-300",
                              priorityFilter === f.value
                                ? "bg-navy-800 dark:bg-gold-500 text-white dark:text-navy-950 border-navy-800 dark:border-gold-500 shadow-md"
                                : "bg-card text-muted-foreground border-border hover:border-navy-300 hover:text-navy-700 dark:hover:text-navy-300"
                            )}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sort */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Sort By</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSortBy("date")}
                          className={cn(
                            "text-xs px-3.5 py-1.5 rounded-full border font-medium transition-all duration-300 flex items-center gap-1.5",
                            sortBy === "date"
                              ? "bg-navy-800 dark:bg-gold-500 text-white dark:text-navy-950 border-navy-800"
                              : "bg-card text-muted-foreground border-border hover:border-navy-300"
                          )}
                        >
                          <Calendar className="w-3 h-3" /> Date
                        </button>
                        <button
                          type="button"
                          onClick={() => setSortBy("priority")}
                          className={cn(
                            "text-xs px-3.5 py-1.5 rounded-full border font-medium transition-all duration-300 flex items-center gap-1.5",
                            sortBy === "priority"
                              ? "bg-navy-800 text-white border-navy-800"
                              : "bg-card text-muted-foreground border-gray-200 dark:border-gray-700 hover:border-navy-300 dark:hover:border-navy-600"
                          )}
                        >
                          <ArrowUpDown className="w-3 h-3" /> Priority
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Results Count */}
        {(search || activeFilters > 0) && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-muted-foreground mb-4"
          >
            Showing {filtered.length} of {complaints.length} petitions
          </motion.p>
        )}

        {/* Results */}
        <motion.div
          ref={ref}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          variants={staggerContainer}
          className="space-y-3"
        >
          {filtered.length === 0 ? (
            <motion.div variants={fadeInUp} className="card-doppelrand">
              <div className="card-doppelrand-inner py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="font-display font-bold text-foreground mb-1 text-lg">No petitions found</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {complaints.length === 0 ? "Submit your first petition to get started." : "Try adjusting your filters."}
                </p>
                {complaints.length === 0 && (
                  <Link to="/citizen/submit" className="btn-primary inline-flex items-center gap-2 text-sm">
                    <PlusCircle className="w-4 h-4" /> Submit Petition
                  </Link>
                )}
              </div>
            </motion.div>
          ) : (
            filtered.map(c => (
              <motion.div key={c.id} variants={fadeInUp}>
                <ComplaintCard complaint={c} linkTo={`/citizen/petition/${c.id}`} />
              </motion.div>
            ))
          )}
        </motion.div>
      </div>
    </div>
  );
}
