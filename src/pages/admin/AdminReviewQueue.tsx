import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Sparkles, 
  History, 
  Building2, 
  Tag, 
  Flame, 
  Check, 
  Clock,
  Filter
} from "lucide-react";
import { toast } from "sonner";
import { useComplaints } from "@/hooks/useComplaints";
import { CATEGORIES, DEPARTMENTS } from "@/constants/mockData";
import { Priority, Complaint } from "@/types";
import { priorityClass, formatDate } from "@/lib/utils";
import { getStoredUser } from "@/lib/auth";

const DEPT_MAP: Record<string, string> = {
  "Road & Infrastructure": "Roads & Infrastructure",
  "Building & Construction": "Roads & Infrastructure",
  "Water Supply": "Water Works",
  "Sanitation": "Waste Management",
  "Electricity": "Electricity Board",
  "Waste Management": "Waste Management",
  "Parks & Recreation": "Waste Management",
  "Noise Pollution": "Public Safety",
  "Public Safety": "Public Safety",
  "Healthcare": "Health Department",
  "Education": "Education Department",
  "Public Transport": "Transport Authority",
};

interface CorrectionRecord {
  id: string;
  complaintId: string;
  petitionId: string;
  correctedBy: string;
  correctedByName: string;
  correctedAt: string;
  before: { category: string; department: string; priority: string };
  after: { category: string; department: string; priority: string };
  note?: string;
}

interface AuditLog {
  id: string;
  action: string;
  entityId: string;
  petitionId: string;
  performedByName: string;
  timestamp: string;
  details: {
    before: { category: string; department: string; priority: string };
    after: { category: string; department: string; priority: string };
    note?: string;
  };
}

export default function AdminReviewQueue() {
  const { complaints, updateComplaint } = useComplaints();
  const [reviewPetitions, setReviewPetitions] = useState<Complaint[]>([]);
  const [correctionsLog, setCorrectionsLog] = useState<CorrectionRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "audit">("pending");

  // Form state per petition: petitionId -> { category, department, priority, note }
  const [editStates, setEditStates] = useState<Record<string, { category: string; department: string; priority: Priority; note: string }>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Load review queue & audit logs from backend
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const user = getStoredUser();
        const headers: Record<string, string> = {};
        if (user?.token) headers["Authorization"] = `Bearer ${user.token}`;

        // Fetch review petitions
        const resReviews = await fetch("/api/complaints/reviews", { headers });
        if (resReviews.ok) {
          const list = await resReviews.json();
          setReviewPetitions(list);
          
          // Initialize edit states
          const initialEdits: Record<string, { category: string; department: string; priority: Priority; note: string }> = {};
          list.forEach((c: Complaint) => {
            initialEdits[c.id] = {
              category: c.category || "Road & Infrastructure",
              department: c.assignedDepartment || "Roads & Infrastructure",
              priority: (c.priority || "medium") as Priority,
              note: "Verified and corrected by municipal administrator.",
            };
          });
          setEditStates(initialEdits);
        } else {
          // Fallback to local complaints
          const flagged = complaints.filter(c => c.human_review_required || c.aiAnalysis?.human_review_required);
          setReviewPetitions(flagged);
        }

        // Fetch all audit logs
        const resAudit = await fetch("/api/complaints/audit/all", { headers });
        if (resAudit.ok) {
          const logs = await resAudit.json();
          setAuditLogs(logs);
        }
      } catch (err) {
        console.warn("Could not load review queue from backend, falling back to local:", err);
        const flagged = complaints.filter(c => c.human_review_required || c.aiAnalysis?.human_review_required);
        setReviewPetitions(flagged);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [complaints]);

  function handleCategoryChange(complaintId: string, newCategory: string) {
    const autoDept = DEPT_MAP[newCategory] || "Roads & Infrastructure";
    setEditStates(prev => ({
      ...prev,
      [complaintId]: {
        ...prev[complaintId],
        category: newCategory,
        department: autoDept,
      },
    }));
  }

  function handleFieldChange(complaintId: string, field: "department" | "priority" | "note", value: string | Priority) {
    setEditStates(prev => ({
      ...prev,
      [complaintId]: {
        ...prev[complaintId],
        [field]: value,
      },
    }));
  }

  async function handleApplyCorrection(petition: Complaint) {
    const edit = editStates[petition.id] || {
      category: petition.category,
      department: petition.assignedDepartment,
      priority: petition.priority,
      note: "Admin reviewed and corrected",
    };

    setSubmittingId(petition.id);
    try {
      const user = getStoredUser();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user?.token) headers["Authorization"] = `Bearer ${user.token}`;

      const res = await fetch(`/api/complaints/${petition.id}/correct`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          category: edit.category,
          department: edit.department,
          priority: edit.priority,
          note: edit.note || "Verified and corrected via Admin Review Panel",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Petition ${petition.petitionId} corrected & verified!`, {
          description: `Routed to ${edit.department} as ${edit.category} (${edit.priority.toUpperCase()}). Audit record saved.`,
        });

        if (data.correction) {
          setCorrectionsLog(prev => [data.correction, ...prev]);
        }
        if (data.auditLog) {
          setAuditLogs(prev => [data.auditLog, ...prev]);
        }

        // Update local complaint state
        updateComplaint(petition.id, {
          category: edit.category,
          assignedDepartment: edit.department,
          priority: edit.priority,
          human_review_required: false,
        });

        // Remove from pending reviews
        setReviewPetitions(prev => prev.filter(p => p.id !== petition.id));
      } else {
        throw new Error(`Server returned ${res.status}`);
      }
    } catch (err) {
      console.warn("Backend correction API failed, applying locally:", err);
      updateComplaint(petition.id, {
        category: edit.category,
        assignedDepartment: edit.department,
        priority: edit.priority,
        human_review_required: false,
      });

      toast.success(`Petition ${petition.petitionId} corrected locally!`);
      setReviewPetitions(prev => prev.filter(p => p.id !== petition.id));
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-amber-500" />
              <h1 className="font-serif text-2xl font-bold text-foreground">Human Review & Correction Panel</h1>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Petitions flagged for manual oversight due to model disagreement, low confidence, or quality checks.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("pending")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "pending"
                  ? "bg-navy-600 text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Pending Reviews ({reviewPetitions.length})
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "audit"
                  ? "bg-navy-600 text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <History className="w-4 h-4" />
              Audit Log ({auditLogs.length + correctionsLog.length})
            </button>
          </div>
        </div>

        {activeTab === "pending" ? (
          <div>
            {isLoading ? (
              <div className="card-base p-12 text-center text-muted-foreground">
                <Clock className="w-8 h-8 animate-spin mx-auto mb-2 text-navy-600" />
                <p>Loading flagged petitions...</p>
              </div>
            ) : reviewPetitions.length === 0 ? (
              <div className="card-base p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-foreground">All Clear! No Pending Reviews</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Every petition currently meets confidence thresholds and has unambiguous AI routing.
                </p>
                <Link
                  to="/admin/complaints"
                  className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-navy-600 text-white text-sm font-medium rounded-lg hover:bg-navy-700 transition-colors"
                >
                  Return to Complaints List
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {reviewPetitions.map(petition => {
                  const edit = editStates[petition.id] || {
                    category: petition.category,
                    department: petition.assignedDepartment,
                    priority: petition.priority,
                    note: "",
                  };
                  const ai = petition.aiAnalysis;
                  const reviewReasons = ai?.review_reasons || petition.review_reasons || [];
                  const isSpam = Boolean(ai?.is_spam);

                  return (
                    <div key={petition.id} className="card-base p-6 border-l-4 border-l-amber-500">
                      {/* Petition Header Info */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-border">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-navy-600 dark:text-navy-300">
                              {petition.petitionId}
                            </span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">{formatDate(petition.submittedAt)}</span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs font-medium text-foreground">{petition.submittedByName}</span>
                          </div>
                          <h2 className="text-lg font-semibold text-foreground mt-1">{petition.title}</h2>
                          <p className="text-xs text-muted-foreground mt-0.5">{petition.location}, {petition.district}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${priorityClass(petition.priority)}`}>
                          {petition.priority.toUpperCase()}
                        </span>
                      </div>

                      {/* Description */}
                      <div className="my-4 p-3 bg-muted/40 rounded-lg">
                        <p className="text-sm text-foreground/90 whitespace-pre-wrap">{petition.description}</p>
                      </div>

                      {/* AI Diagnostic Reasons */}
                      <div className="mb-5 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                            Flags Requiring Human Review
                          </h4>
                        </div>
                        <ul className="text-xs text-amber-900 dark:text-amber-200 list-disc list-inside space-y-1">
                          {reviewReasons.length > 0 ? (
                            reviewReasons.map((r: string, idx: number) => <li key={idx}>{r}</li>)
                          ) : (
                            <li>Confidence threshold ({roundPercentage(ai?.categoryConfidence)}%) below auto-dispatch cutoff.</li>
                          )}
                          {isSpam && <li className="font-semibold">Quality check triggered: Potential junk, repeated, or test content.</li>}
                        </ul>
                      </div>

                      {/* One-Click Correction Grid */}
                      <div className="bg-muted/30 p-4 rounded-xl border border-border">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-4 h-4 text-navy-600 dark:text-navy-300" />
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                            One-Click Administrator Correction
                          </h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          {/* Category Selector */}
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Category
                            </label>
                            <select
                              value={edit.category}
                              onChange={e => handleCategoryChange(petition.id, e.target.value)}
                              className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-navy-600"
                            >
                              {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Department Selector */}
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Assigned Department
                            </label>
                            <select
                              value={edit.department}
                              onChange={e => handleFieldChange(petition.id, "department", e.target.value)}
                              className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-navy-600"
                            >
                              {DEPARTMENTS.map(d => (
                                <option key={d.name} value={d.name}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Priority Selector */}
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Priority Level
                            </label>
                            <select
                              value={edit.priority}
                              onChange={e => handleFieldChange(petition.id, "priority", e.target.value as Priority)}
                              className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-navy-600"
                            >
                              <option value="low">Low Priority</option>
                              <option value="medium">Medium Priority</option>
                              <option value="high">High Priority</option>
                              <option value="critical">Critical Urgency</option>
                            </select>
                          </div>
                        </div>

                        {/* Note & Action Button */}
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                          <input
                            type="text"
                            placeholder="Optional correction note or reason (saved to audit trail)..."
                            value={edit.note}
                            onChange={e => handleFieldChange(petition.id, "note", e.target.value)}
                            className="flex-1 w-full text-xs bg-background border border-border rounded-lg px-3 py-2.5 text-foreground placeholder:text-muted-foreground"
                          />
                          <button
                            onClick={() => handleApplyCorrection(petition)}
                            disabled={submittingId === petition.id}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-navy-600 text-white rounded-lg text-sm font-semibold hover:bg-navy-700 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap"
                          >
                            <Check className="w-4 h-4" />
                            {submittingId === petition.id ? "Saving..." : "Apply & Approve"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Audit Log Tab */
          <div className="card-base p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <div>
                <h3 className="font-semibold text-base text-foreground">Administrative Correction Audit Trail</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Immutable log of every human override, timestamp, before/after values, and administrator ID.
                </p>
              </div>
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                collection: audit_logs & corrections
              </span>
            </div>

            {auditLogs.length === 0 && correctionsLog.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No administrative corrections logged yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Petition ID</th>
                      <th className="py-2.5 px-3">Admin</th>
                      <th className="py-2.5 px-3">Before</th>
                      <th className="py-2.5 px-3">After</th>
                      <th className="py-2.5 px-3">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-muted/30">
                        <td className="py-3 px-3 whitespace-nowrap text-muted-foreground">
                          {formatDate(log.timestamp)}
                        </td>
                        <td className="py-3 px-3 font-mono font-medium text-navy-600 dark:text-navy-300">
                          {log.petitionId}
                        </td>
                        <td className="py-3 px-3 font-medium text-foreground">
                          {log.performedByName || "Admin"}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 text-[11px]">
                            {log.details?.before?.category} • {log.details?.before?.department} • {log.details?.before?.priority}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium">
                            {log.details?.after?.category} • {log.details?.after?.department} • {log.details?.after?.priority}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-muted-foreground italic">
                          {log.details?.note || "Admin override"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function roundPercentage(val?: number): number {
  if (!val) return 0;
  return Math.round(val * 100);
}

