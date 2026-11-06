import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Sparkles, 
  History, 
  Check, 
  Clock, 
  Search,
  Trash2,
  HelpCircle,
  Languages,
  Send,
  X
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
  approved_as_is?: boolean;
}

interface AuditLog {
  id: string;
  action: string;
  entityId: string;
  petitionId: string;
  performedByName: string;
  timestamp: string;
  details?: {
    before?: { category?: string; department?: string; priority?: string };
    after?: { category?: string; department?: string; priority?: string };
    beforeStatus?: string;
    newStatus?: string;
    assignedDepartment?: string;
    officerRemarks?: string;
    resolutionDetails?: string;
    category?: string;
    department?: string;
    priority?: string;
    confidence?: number;
    explanation?: string;
    human_review_required?: boolean;
    note?: string;
    reason?: string;
  };
}

export default function AdminReviewQueue() {
  const { complaints, updateComplaint } = useComplaints();
  const [reviewPetitions, setReviewPetitions] = useState<Complaint[]>([]);
  const [correctionsLog, setCorrectionsLog] = useState<CorrectionRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "audit">("pending");
  const [filterPetitionId, setFilterPetitionId] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");

  // Form state per petition: petitionId -> { category, department, priority, note }
  const [editStates, setEditStates] = useState<Record<string, { category: string; department: string; priority: Priority; note: string }>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Modal / inline prompts for Request Details or Mark Spam
  const [detailModalId, setDetailModalId] = useState<string | null>(null);
  const [detailNote, setDetailNote] = useState("Please provide additional location landmarks or photos.");
  const [spamModalId, setSpamModalId] = useState<string | null>(null);
  const [spamReason, setSpamReason] = useState("Identified as spam or test content by administrator.");

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (filterPetitionId.trim()) {
        const q = filterPetitionId.trim().toLowerCase();
        const matchesPid = log.petitionId?.toLowerCase().includes(q);
        const matchesEid = log.entityId?.toLowerCase().includes(q);
        if (!matchesPid && !matchesEid) return false;
      }
      if (filterAction !== "all") {
        if (log.action?.toLowerCase() !== filterAction.toLowerCase()) return false;
      }
      return true;
    });
  }, [auditLogs, filterPetitionId, filterAction]);

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

  // Action 1: Approve as is
  async function handleApproveAsIs(petition: Complaint) {
    setSubmittingId(petition.id);
    try {
      const user = getStoredUser();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user?.token) headers["Authorization"] = `Bearer ${user.token}`;

      const res = await fetch(`/api/complaints/${petition.id}/approve`, {
        method: "POST",
        headers,
      });

      if (res.ok) {
        toast.success(`Petition ${petition.petitionId} approved as-is!`, {
          description: "Routed to officer queue. Citizen notified in their language.",
        });
        updateComplaint(petition.id, {
          status: "assigned",
          human_review_required: false,
        });
        setReviewPetitions(prev => prev.filter(p => p.id !== petition.id));
      } else {
        throw new Error(`Server returned ${res.status}`);
      }
    } catch {
      updateComplaint(petition.id, {
        status: "assigned",
        human_review_required: false,
      });
      toast.success(`Petition ${petition.petitionId} approved as-is locally!`);
      setReviewPetitions(prev => prev.filter(p => p.id !== petition.id));
    } finally {
      setSubmittingId(null);
    }
  }

  // Action 2: Correct & dispatch
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
          description: `Routed to ${edit.department} as ${edit.category} (${edit.priority.toUpperCase()}).`,
        });

        if (data.correction) {
          setCorrectionsLog(prev => [data.correction, ...prev]);
        }
        if (data.auditLog) {
          setAuditLogs(prev => [data.auditLog, ...prev]);
        }

        updateComplaint(petition.id, {
          category: edit.category,
          assignedDepartment: edit.department,
          priority: edit.priority,
          status: "assigned",
          human_review_required: false,
        });

        setReviewPetitions(prev => prev.filter(p => p.id !== petition.id));
      } else {
        throw new Error(`Server returned ${res.status}`);
      }
    } catch {
      updateComplaint(petition.id, {
        category: edit.category,
        assignedDepartment: edit.department,
        priority: edit.priority,
        status: "assigned",
        human_review_required: false,
      });
      toast.success(`Petition ${petition.petitionId} corrected locally!`);
      setReviewPetitions(prev => prev.filter(p => p.id !== petition.id));
    } finally {
      setSubmittingId(null);
    }
  }

  // Action 3: Mark as spam
  async function handleMarkSpam(petition: Complaint) {
    setSubmittingId(petition.id);
    try {
      const user = getStoredUser();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user?.token) headers["Authorization"] = `Bearer ${user.token}`;

      const res = await fetch(`/api/complaints/${petition.id}/mark-spam`, {
        method: "POST",
        headers,
        body: JSON.stringify({ reason: spamReason }),
      });

      if (res.ok) {
        toast.info(`Petition ${petition.petitionId} marked as spam and archived.`, {
          description: "Excluded from officer queue and saved to audit log.",
        });
        updateComplaint(petition.id, {
          status: "closed",
          human_review_required: false,
        });
        setReviewPetitions(prev => prev.filter(p => p.id !== petition.id));
      } else {
        throw new Error(`Server returned ${res.status}`);
      }
    } catch {
      updateComplaint(petition.id, {
        status: "closed",
        human_review_required: false,
      });
      toast.info(`Petition ${petition.petitionId} marked as spam locally.`);
      setReviewPetitions(prev => prev.filter(p => p.id !== petition.id));
    } finally {
      setSubmittingId(null);
      setSpamModalId(null);
    }
  }

  // Action 4: Ask citizen for more details
  async function handleRequestDetails(petition: Complaint) {
    setSubmittingId(petition.id);
    try {
      const user = getStoredUser();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (user?.token) headers["Authorization"] = `Bearer ${user.token}`;

      const res = await fetch(`/api/complaints/${petition.id}/request-details`, {
        method: "POST",
        headers,
        body: JSON.stringify({ note: detailNote }),
      });

      if (res.ok) {
        toast.success(`Additional details requested for ${petition.petitionId}!`, {
          description: "Notification and SMS sent to citizen.",
        });
        setDetailModalId(null);
      } else {
        throw new Error(`Server returned ${res.status}`);
      }
    } catch {
      toast.success(`Details request logged locally for ${petition.petitionId}.`);
      setDetailModalId(null);
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
                  const isNonEnglish = petition.detected_language && petition.detected_language !== "en";
                  const langName = petition.language_name || (petition.detected_language === "ta" ? "Tamil (தமிழ்)" : petition.detected_language === "hi" ? "Hindi (हिन्दी)" : "Indian Language");

                  return (
                    <div key={petition.id} className="card-base p-6 border-l-4 border-l-amber-500">
                      {/* Petition Header Info */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-border">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-navy-600 dark:text-navy-300">
                              {petition.petitionId}
                            </span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">{formatDate(petition.submittedAt)}</span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs font-medium text-foreground">{petition.submittedByName}</span>
                            {isNonEnglish && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                                <Languages className="w-3 h-3" />
                                {langName}
                              </span>
                            )}
                          </div>
                          <h2 className="text-lg font-semibold text-foreground mt-1">{petition.title}</h2>
                          <p className="text-xs text-muted-foreground mt-0.5">{petition.location}, {petition.district}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${priorityClass(petition.priority)}`}>
                          {petition.priority.toUpperCase()}
                        </span>
                      </div>

                      {/* Description & Translation if not English (Task 5.2) */}
                      <div className="my-4 space-y-2">
                        <div className="p-3 bg-muted/40 rounded-lg">
                          <div className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                            Petition Content {isNonEnglish ? `(Original: ${langName})` : ""}
                          </div>
                          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{petition.description}</p>
                        </div>
                        {isNonEnglish && petition.original_text && (
                          <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">
                              <Languages className="w-3.5 h-3.5" />
                              Detected Native Script:
                            </div>
                            <p className="text-xs text-blue-900 dark:text-blue-200 italic font-sans">{petition.original_text}</p>
                          </div>
                        )}
                      </div>

                      {/* AI Diagnostic Reasons & Result */}
                      <div className="mb-5 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                              AI Result & Review Diagnostic
                            </h4>
                          </div>
                          {ai?.confidence && (
                            <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                              Confidence: {roundPercentage(ai.confidence)}%
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-amber-900/90 dark:text-amber-200 mb-2 font-medium">
                          {ai?.explanation || "AI routed to department based on text features."}
                        </p>
                        <ul className="text-xs text-amber-900 dark:text-amber-200 list-disc list-inside space-y-1">
                          {reviewReasons.length > 0 ? (
                            reviewReasons.map((r: string, idx: number) => <li key={idx}>{r}</li>)
                          ) : (
                            <li>Confidence threshold ({roundPercentage(ai?.categoryConfidence)}%) below auto-dispatch cutoff.</li>
                          )}
                          {isSpam && <li className="font-semibold text-red-600 dark:text-red-400">Quality check triggered: Potential junk, repeated, or test content.</li>}
                        </ul>
                      </div>

                      {/* 4 One-Click Actions Bar (Task 5.3) */}
                      <div className="bg-muted/30 p-4 rounded-xl border border-border">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-4 h-4 text-navy-600 dark:text-navy-300" />
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                            One-Click Administrator Actions
                          </h4>
                        </div>

                        {/* Top quick action buttons */}
                        <div className="flex flex-wrap items-center gap-2.5 mb-4">
                          <button
                            onClick={() => handleApproveAsIs(petition)}
                            disabled={submittingId === petition.id}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Approve as is
                          </button>

                          <button
                            onClick={() => setDetailModalId(petition.id)}
                            disabled={submittingId === petition.id}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            <HelpCircle className="w-4 h-4" />
                            Ask citizen for more details
                          </button>

                          <button
                            onClick={() => setSpamModalId(petition.id)}
                            disabled={submittingId === petition.id}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            Mark as spam
                          </button>
                        </div>

                        {/* Inline Detail Request Form */}
                        {detailModalId === petition.id && (
                          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                                Ask Citizen for Details (via SMS & status notification)
                              </span>
                              <button onClick={() => setDetailModalId(null)} className="text-muted-foreground hover:text-foreground">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={detailNote}
                                onChange={e => setDetailNote(e.target.value)}
                                className="flex-1 text-xs bg-background border border-border rounded-lg px-3 py-1.5 text-foreground"
                              />
                              <button
                                onClick={() => handleRequestDetails(petition)}
                                disabled={submittingId === petition.id}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
                              >
                                <Send className="w-3.5 h-3.5" />
                                Send
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Inline Spam Reason Form */}
                        {spamModalId === petition.id && (
                          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-red-900 dark:text-red-200">
                                Archive as Spam (Petition will NOT be sent to officer)
                              </span>
                              <button onClick={() => setSpamModalId(null)} className="text-muted-foreground hover:text-foreground">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={spamReason}
                                onChange={e => setSpamReason(e.target.value)}
                                className="flex-1 text-xs bg-background border border-border rounded-lg px-3 py-1.5 text-foreground"
                              />
                              <button
                                onClick={() => handleMarkSpam(petition)}
                                disabled={submittingId === petition.id}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Confirm Spam
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Correction Fields: Category / Department / Priority */}
                        <div className="pt-3 border-t border-border">
                          <div className="text-xs font-semibold text-muted-foreground mb-2">
                            Manual Correction (Overrides AI routing and dispatches to officer):
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                            <div>
                              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                                Category
                              </label>
                              <select
                                value={edit.category}
                                onChange={e => handleCategoryChange(petition.id, e.target.value)}
                                className="w-full text-xs bg-background border border-border rounded-lg px-2.5 py-2 text-foreground focus:ring-2 focus:ring-navy-600"
                              >
                                {CATEGORIES.map(cat => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                                Assigned Department
                              </label>
                              <select
                                value={edit.department}
                                onChange={e => handleFieldChange(petition.id, "department", e.target.value)}
                                className="w-full text-xs bg-background border border-border rounded-lg px-2.5 py-2 text-foreground focus:ring-2 focus:ring-navy-600"
                              >
                                {DEPARTMENTS.map(d => (
                                  <option key={d.name} value={d.name}>
                                    {d.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                                Priority Level
                              </label>
                              <select
                                value={edit.priority}
                                onChange={e => handleFieldChange(petition.id, "priority", e.target.value as Priority)}
                                className="w-full text-xs bg-background border border-border rounded-lg px-2.5 py-2 text-foreground focus:ring-2 focus:ring-navy-600"
                              >
                                <option value="low">Low Priority</option>
                                <option value="medium">Medium Priority</option>
                                <option value="high">High Priority</option>
                                <option value="critical">Critical Urgency</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-center gap-3">
                            <input
                              type="text"
                              placeholder="Correction note or reason for retraining log..."
                              value={edit.note}
                              onChange={e => handleFieldChange(petition.id, "note", e.target.value)}
                              className="flex-1 w-full text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground"
                            />
                            <button
                              onClick={() => handleApplyCorrection(petition)}
                              disabled={submittingId === petition.id}
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-navy-600 text-white rounded-lg text-xs font-semibold hover:bg-navy-700 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap"
                            >
                              <Check className="w-3.5 h-3.5" />
                              {submittingId === petition.id ? "Saving..." : "Correct & Dispatch"}
                            </button>
                          </div>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-border">
              <div>
                <h3 className="font-semibold text-base text-foreground">System & Administrative Audit Trail</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Immutable record of every AI decision, officer override, and administrative correction with exact timestamps.
                </p>
              </div>
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded w-fit">
                collection: audit_logs & corrections
              </span>
            </div>

            {/* Filter controls */}
            <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter by Petition ID (e.g. PET-2026-001)..."
                  value={filterPetitionId}
                  onChange={e => setFilterPetitionId(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <select
                value={filterAction}
                onChange={e => setFilterAction(e.target.value)}
                className="w-full sm:w-auto text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground font-medium"
              >
                <option value="all">All Actions ({auditLogs.length})</option>
                <option value="ai_decision">AI Decision</option>
                <option value="admin_approve">Admin Approve</option>
                <option value="admin_correction">Admin Correction</option>
                <option value="admin_mark_spam">Mark Spam</option>
                <option value="admin_request_details">Request Details</option>
                <option value="sla_auto_escalation">SLA Auto Escalation</option>
              </select>
            </div>

            {filteredAuditLogs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No audit trail records matching filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Petition ID</th>
                      <th className="py-2.5 px-3">Actor</th>
                      <th className="py-2.5 px-3">Details / Changes</th>
                      <th className="py-2.5 px-3">Note / Explanation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredAuditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-muted/30">
                        <td className="py-3 px-3 whitespace-nowrap text-muted-foreground">
                          {formatDate(log.timestamp)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {log.action === "ai_decision" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                              <Sparkles className="w-3 h-3" />
                              AI Decision
                            </span>
                          ) : log.action === "admin_approve" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3" />
                              Approved As Is
                            </span>
                          ) : log.action === "admin_mark_spam" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                              <Trash2 className="w-3 h-3" />
                              Marked Spam
                            </span>
                          ) : log.action === "sla_auto_escalation" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                              <AlertTriangle className="w-3 h-3" />
                              SLA Escalation
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                              <Check className="w-3 h-3" />
                              {log.action.replace("_", " ")}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono font-medium text-navy-600 dark:text-navy-300 whitespace-nowrap">
                          {log.petitionId || log.entityId}
                        </td>
                        <td className="py-3 px-3 font-medium text-foreground whitespace-nowrap">
                          {log.performedByName || "System"}
                        </td>
                        <td className="py-3 px-3">
                          {log.action === "admin_correction" && log.details?.before && log.details?.after ? (
                            <div className="flex items-center gap-1 text-[11px]">
                              <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
                                {log.details.before.category} • {log.details.before.department} • {log.details.before.priority}
                              </span>
                              <span className="text-muted-foreground">→</span>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-medium">
                                {log.details.after.category} • {log.details.after.department} • {log.details.after.priority}
                              </span>
                            </div>
                          ) : log.action === "sla_auto_escalation" ? (
                            <div className="text-[11px] text-red-600 font-medium">
                              SLA Breached ({log.details?.overdueHours}h overdue) → Auto-escalated
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground italic max-w-xs truncate">
                          {log.details?.note || log.details?.reason || log.details?.explanation || "—"}
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
