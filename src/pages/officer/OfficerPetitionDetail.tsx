import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Save, AlertTriangle, CheckCircle, Upload, Download, FileSpreadsheet, Lightbulb, Sparkles, CopyCheck, Send, FileText, Globe, Check } from "lucide-react";
import { useComplaints } from "@/hooks/useComplaints";
import { useAuth } from "@/lib/auth";
import AIAnalysisCard from "@/components/features/AIAnalysisCard";
import StatusTimeline from "@/components/features/StatusTimeline";
import SLABadge from "@/components/features/SLABadge";
import QRCode from "@/components/features/QRCode";
import ErrorBoundary from "@/components/features/ErrorBoundary";
import { generatePetitionPDF } from "@/lib/pdfExport";
import { exportSingleComplaintToExcel } from "@/lib/excelExport";
import { cn, statusClass, statusLabel, priorityClass, formatDateTime } from "@/lib/utils";
import { ComplaintStatus } from "@/types";
import { toast } from "sonner";

interface ResolutionSuggestion {
  petitionId: string;
  title: string;
  category: string;
  department: string;
  actionTaken: string;
  daysToResolve: number;
  similarity: number;
  confidence: number;
  explanation: string;
}

interface OfficialDraftResponse {
  petitionId: string;
  language: string;
  letterType: string;
  subject: string;
  citizenLetter: string;
  rtiLetter: string;
  recipient: string;
  department: string;
  officer: string;
  confidence: number;
  explanation: string;
}

const STATUS_OPTIONS: { value: ComplaintStatus; label: string }[] = [
  { value: "under_review", label: "Under Review" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export default function OfficerPetitionDetail() {
  const { id } = useParams<{ id: string }>();
  const { complaints, updateComplaint } = useComplaints();
  const { user } = useAuth();
  const complaint = complaints.find(c => c.id === id);

  const [newStatus, setNewStatus] = useState<ComplaintStatus>(complaint?.status || "under_review");
  const [remarks, setRemarks] = useState(complaint?.officerRemarks || "");
  const [resolutionDetails, setResolutionDetails] = useState(complaint?.resolutionDetails || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [suggestions, setSuggestions] = useState<ResolutionSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [draftType, setDraftType] = useState<"citizen_letter" | "rti_response">("citizen_letter");
  const [draftData, setDraftData] = useState<OfficialDraftResponse | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [dispatched, setDispatched] = useState(false);

  useEffect(() => {
    if (!complaint?.id) return;
    const fetchDraft = async () => {
      setDraftLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`/api/complaints/${complaint.id}/draft-response`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = (await res.json()) as OfficialDraftResponse;
          setDraftData(data);
          setDraftText(data.citizenLetter);
        }
      } catch (err) {
        console.warn("Could not load auto-draft:", err);
      } finally {
        setDraftLoading(false);
      }
    };
    fetchDraft();
  }, [complaint?.id]);

  function handleDraftTypeChange(type: "citizen_letter" | "rti_response") {
    setDraftType(type);
    if (draftData) {
      setDraftText(type === "rti_response" ? draftData.rtiLetter : draftData.citizenLetter);
    }
  }

  async function handleDispatchLetter() {
    if (!complaint?.id || !draftText.trim()) return;
    setDispatching(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/complaints/${complaint.id}/send-official-response`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          letterText: draftText,
          letterType: draftType,
        }),
      });
      if (res.ok) {
        setDispatched(true);
        toast.success(`Official ${draftType === "rti_response" ? "RTI" : "Citizen"} letter dispatched!`);
        setTimeout(() => setDispatched(false), 4000);
      }
    } catch (err) {
      toast.error("Failed to dispatch letter");
    } finally {
      setDispatching(false);
    }
  }

  useEffect(() => {
    if (!complaint?.id) return;
    const fetchSuggestions = async () => {
      setLoadingSuggestions(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`/api/complaints/${complaint.id}/resolution-suggestions`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.suggestions || []);
        }
      } catch (err) {
        console.warn("Could not load resolution suggestions:", err);
      } finally {
        setLoadingSuggestions(false);
      }
    };
    fetchSuggestions();
  }, [complaint?.id]);

  function applySuggestion(s: ResolutionSuggestion) {
    setResolutionDetails(s.actionTaken);
    setRemarks(`Applied historical remediation standard from ${s.petitionId}: ${s.actionTaken}`);
    setNewStatus("resolved");
    toast.success(`Applied solution template from ${s.petitionId}`);
  }

  if (!complaint) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-bold text-foreground mb-2">Complaint Not Found</p>
          <Link to="/officer/dashboard" className="text-navy-600 dark:text-navy-300 hover:underline">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  async function handleSave() {
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));

    const newHistory = newStatus !== complaint!.status
      ? [...complaint!.statusHistory, {
          status: newStatus,
          timestamp: new Date().toISOString(),
          note: remarks || `Status updated to ${statusLabel(newStatus)}`,
          updatedBy: user?.name || "Officer",
        }]
      : complaint!.statusHistory;

    updateComplaint(complaint!.id, {
      status: newStatus,
      officerRemarks: remarks,
      resolutionDetails: newStatus === "resolved" ? resolutionDetails : complaint!.resolutionDetails,
      resolutionProof: newStatus === "resolved" ? `Resolved on ${new Date().toLocaleDateString("en-IN")}` : complaint!.resolutionProof,
      assignedOfficer: "o1",
      assignedOfficerName: user?.name,
      statusHistory: newHistory,
    });
    setSaving(false);
    setSaved(true);
    toast.success("Complaint updated successfully");
    setTimeout(() => setSaved(false), 3000);
  }

  function escalate() {
    updateComplaint(complaint!.id, {
      isEscalated: true,
      statusHistory: [...complaint!.statusHistory, {
        status: complaint!.status,
        timestamp: new Date().toISOString(),
        note: "Complaint escalated to senior officer due to delay.",
        updatedBy: user?.name || "Officer",
      }],
    });
    toast.warning("Complaint escalated");
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-navy-975 text-foreground py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <Link to="/officer/dashboard" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>

          {/* Header */}
          <div className="card-reference p-6 mb-6 bg-surface-card border-surface-border">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="font-mono font-bold text-navy-700 bg-navy-50 dark:bg-navy-900/60 dark:text-navy-200 px-2.5 py-1 rounded text-sm">{complaint.petitionId}</span>
                  <span className={cn("text-xs font-semibold px-2 py-1 rounded border", statusClass(complaint.status))}>{statusLabel(complaint.status)}</span>
                  <span className={cn("text-xs font-semibold px-2 py-1 rounded border", priorityClass(complaint.priority))}>{complaint.priority.toUpperCase()}</span>
                  {complaint.isEscalated && <span className="text-xs bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800/60 px-2 py-1 rounded font-semibold flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Escalated</span>}
                </div>
                <h1 className="font-serif text-xl font-bold text-foreground mb-2">{complaint.title}</h1>
                <p className="text-sm text-muted-foreground">{complaint.description}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {!complaint.isEscalated && complaint.status !== "resolved" && (
                  <button onClick={escalate} className="flex items-center gap-1.5 text-xs text-red-600 border border-red-300 dark:text-red-400 dark:border-red-800/60 dark:hover:bg-red-950/40 px-3 py-2 rounded-md hover:bg-red-50 transition-colors">
                    <AlertTriangle className="w-3.5 h-3.5" /> Escalate
                  </button>
                )}
              </div>
            </div>

            {/* SLA Badge */}
            <div className="mt-3">
              <SLABadge complaint={complaint} />
            </div>

            {/* Export Buttons */}
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={() => generatePetitionPDF(complaint)}
                className="inline-flex items-center gap-1.5 text-xs bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/60 px-3 py-1.5 rounded-md hover:bg-red-100 transition-colors">
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
              <button onClick={() => exportSingleComplaintToExcel(complaint)}
                className="inline-flex items-center gap-1.5 text-xs bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800/60 px-3 py-1.5 rounded-md hover:bg-green-100 transition-colors">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-sm">
              {[
                ["Citizen", complaint.submittedByName],
                ["Department", complaint.assignedDepartment],
                ["Category", complaint.category],
                ["Location", complaint.location],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-muted-foreground">{k}</p>
                  <p className="font-medium text-sm mt-0.5">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* QR Code */}
          <div className="card-reference p-5 mb-6 flex items-center gap-4 bg-surface-card border-surface-border">
            <QRCode value={`https://petitionai.gov.in/track/${complaint.petitionId}`} size={70} />
            <div>
              <p className="text-sm font-semibold text-foreground">Track this petition</p>
              <p className="text-xs text-muted-foreground">Scan QR code or share the petition ID</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-5">
            {/* AI Analysis */}
            <div className="lg:col-span-2">
              <AIAnalysisCard analysis={complaint.aiAnalysis} />
            </div>

            {/* Status Timeline */}
            <div className="lg:col-span-3">
              <StatusTimeline currentStatus={complaint.status} history={complaint.statusHistory} />
            </div>
          </div>

          {/* AI RAG Resolution Suggestions Card */}
          <div className="card-base mb-5 overflow-hidden border border-indigo-200 dark:border-indigo-900/60 shadow-sm">
            <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 text-white px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-300" />
                <span className="font-semibold text-sm">AI Resolution Suggestions (RAG)</span>
                <span className="text-[11px] bg-indigo-600/80 text-indigo-100 px-2 py-0.5 rounded-full font-medium">
                  Past Precedents
                </span>
              </div>
              <span className="text-xs text-indigo-200">
                {suggestions.length} matching resolution{suggestions.length === 1 ? "" : "s"} found
              </span>
            </div>

            <div className="p-5 bg-indigo-50/20 dark:bg-indigo-950/20 divide-y divide-border/60">
              {loadingSuggestions ? (
                <div className="text-center py-4 text-xs text-muted-foreground animate-pulse">
                  Retrieving similar resolved petition solutions...
                </div>
              ) : suggestions.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  No similar past resolutions found in archive.
                </div>
              ) : (
                suggestions.map((s, idx) => (
                  <div key={idx} className={idx > 0 ? "pt-4 mt-4" : ""}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-indigo-800 dark:text-indigo-300">{s.petitionId}</span>
                        <span className="text-xs font-semibold text-foreground truncate max-w-md">{s.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {Math.round(s.similarity * 100)}% Match
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                          ⚡ ~{s.daysToResolve}d turnaround
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-white dark:bg-gray-900 border border-border/80 rounded-lg text-xs space-y-2">
                      <div>
                        <strong className="text-foreground font-semibold">Remediation Action Taken:</strong>
                        <p className="text-muted-foreground mt-0.5 font-mono text-[11px] bg-muted/40 p-2 rounded">
                          {s.actionTaken}
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <p className="text-[10px] text-muted-foreground">
                          {s.explanation}
                        </p>
                        <button
                          type="button"
                          onClick={() => applySuggestion(s)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold transition-colors cursor-pointer shrink-0"
                        >
                          <CopyCheck className="w-3.5 h-3.5" /> Use as Solution Template
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Officer Action Panel */}
          <div className="card-reference overflow-hidden bg-surface-card border-surface-border">
            <div className="bg-navy-800 text-white px-5 py-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-gold-400" />
              <span className="font-semibold text-sm">Officer Action Panel</span>
            </div>
            <div className="p-5 space-y-4">
              {saved && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 dark:bg-green-950/40 dark:border-green-800/60 dark:text-green-300 px-3 py-2.5 rounded-md text-sm">
                  <CheckCircle className="w-4 h-4" /> Changes saved successfully.
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Update Status</label>
                <select value={newStatus} onChange={e => setNewStatus(e.target.value as ComplaintStatus)}
                  className="w-full border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400">
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Officer Remarks</label>
                <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3} placeholder="Add your remarks, findings, or action taken..."
                  className="w-full border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 resize-none" />
              </div>

              {newStatus === "resolved" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Resolution Details</label>
                  <textarea value={resolutionDetails} onChange={e => setResolutionDetails(e.target.value)} rows={3} placeholder="Describe how the issue was resolved..."
                    className="w-full border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 resize-none" />
                  <div className="border-2 border-dashed border-border rounded-md p-4 text-center mt-3">
                    <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Upload resolution proof (photo/document)</p>
                  </div>
                </div>
              )}

              <button onClick={handleSave} disabled={saving}
                className="bg-navy-800 hover:bg-navy-700 disabled:opacity-60 text-white font-semibold px-6 py-2.5 rounded-md transition-colors flex items-center gap-2">
                {saving ? "Saving..." : <><Save className="w-4 h-4" /> Save Changes</>}
              </button>
            </div>
          </div>

          {/* Auto-Drafted Official Response & RTI Letter Panel */}
          <div className="card-base mt-6 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-sm">Official Reply & RTI Response Generator</span>
                {draftData?.language && (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-slate-700 text-slate-200 px-2 py-0.5 rounded-full font-medium">
                    <Globe className="w-3 h-3" />
                    {draftData.language === "ta" ? "Tamil" : draftData.language === "hi" ? "Hindi" : "English"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 bg-slate-700/80 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => handleDraftTypeChange("citizen_letter")}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    draftType === "citizen_letter"
                      ? "bg-emerald-600 text-white"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Citizen Formal Letter
                </button>
                <button
                  type="button"
                  onClick={() => handleDraftTypeChange("rti_response")}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    draftType === "rti_response"
                      ? "bg-emerald-600 text-white"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  RTI Compliance Response
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {dispatched && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 px-3 py-2.5 rounded-md text-sm">
                  <Check className="w-4 h-4 text-emerald-600" />
                  Official communication successfully dispatched to petitioner. Audit log updated.
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <p>
                  Review and edit the formal administrative correspondence before dispatching. Never sent automatically.
                </p>
                {draftData?.confidence && (
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    Draft Confidence: {Math.round(draftData.confidence * 100)}%
                  </span>
                )}
              </div>

              {draftLoading ? (
                <div className="text-center py-8 text-xs text-muted-foreground animate-pulse">
                  Drafting administrative reply in petitioner's detected language...
                </div>
              ) : (
                <textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  rows={10}
                  className="w-full font-mono text-xs p-3.5 border border-border rounded-lg bg-muted/20 focus:outline-none focus:ring-2 focus:ring-slate-400 leading-relaxed resize-y"
                  placeholder="Auto-drafted official response will appear here..."
                />
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <p className="text-[11px] text-muted-foreground italic">
                  Includes mandatory RTI Section 19(1) appellate rights clause.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(draftText);
                      toast.success("Letter copied to clipboard");
                    }}
                    className="px-3.5 py-2 text-xs border border-border rounded-md hover:bg-muted font-medium transition-colors cursor-pointer"
                  >
                    Copy Text
                  </button>
                  <button
                    type="button"
                    onClick={handleDispatchLetter}
                    disabled={dispatching || !draftText.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-md text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {dispatching ? "Dispatching..." : "Approve & Dispatch Official Communication"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
