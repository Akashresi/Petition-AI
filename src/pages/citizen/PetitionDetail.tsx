import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Building2, 
  User, 
  Star, 
  RotateCcw, 
  AlertTriangle, 
  Download, 
  FileSpreadsheet, 
  Clock,
  ThumbsUp,
  Link2,
  Volume2
} from "lucide-react";
import { toast } from "sonner";
import { useComplaints } from "@/hooks/useComplaints";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { speakText, isSpeaking, stopSpeaking } from "@/lib/tts";
import StatusBadge from "@/components/ui/accessible/StatusBadge";
import AccessibleButton from "@/components/ui/accessible/AccessibleButton";
import AIAnalysisCard from "@/components/features/AIAnalysisCard";
import StatusTimeline from "@/components/features/StatusTimeline";
import QRCode from "@/components/features/QRCode";
import SLABadge from "@/components/features/SLABadge";
import CommentSection from "@/components/features/CommentSection";
import EscalationBadge, { EscalationTimeline } from "@/components/features/EscalationBadge";
import ErrorBoundary from "@/components/features/ErrorBoundary";
import { generatePetitionPDF } from "@/lib/pdfExport";
import { exportSingleComplaintToExcel } from "@/lib/excelExport";
import { cn, statusClass, statusLabel, priorityClass, formatDateTime, formatDate } from "@/lib/utils";

export default function PetitionDetail() {
  const { id } = useParams<{ id: string }>();
  const { complaints, updateComplaint } = useComplaints();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [isReading, setIsReading] = useState(false);

  const complaint = complaints.find(c => c.id === id);

  const handleReadAloud = () => {
    if (!complaint) return;
    if (isSpeaking()) {
      stopSpeaking();
      setIsReading(false);
      return;
    }
    const plainText = language === "ta"
      ? `மனு எண் ${complaint.petitionId}. ${complaint.title}. நிலை: ${complaint.status}. துறை: ${complaint.assignedDepartment}.`
      : language === "hi"
      ? `शिकायत संख्या ${complaint.petitionId}। ${complaint.title}। स्थिति: ${complaint.status}। विभाग: ${complaint.assignedDepartment}।`
      : `Petition number ${complaint.petitionId}. ${complaint.title}. Status: ${complaint.status}. Department: ${complaint.assignedDepartment}.`;

    setIsReading(true);
    speakText(plainText, language, () => setIsReading(false), () => setIsReading(false));
  };
  const [supporterCount, setSupporterCount] = useState(complaint?.supporterCount || 1);
  const [hasSupported, setHasSupported] = useState(
    Boolean(user?.id && complaint?.supporters?.includes(user.id))
  );
  const [isSupporting, setIsSupporting] = useState(false);

  async function handleSupport() {
    if (!complaint || hasSupported || isSupporting) return;
    setIsSupporting(true);
    try {
      const res = await fetch(`/api/complaints/${complaint.id}/support`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        setSupporterCount(data.supporterCount);
        setHasSupported(true);
        toast.success("Support recorded!", {
          description: "You have been registered as a supporter of this grievance.",
        });
        updateComplaint(complaint.id, {
          supporterCount: data.supporterCount,
          supporters: [...(complaint.supporters || []), user?.id || ""],
        });
      } else {
        throw new Error("Failed to record support");
      }
    } catch {
      setSupporterCount(prev => prev + 1);
      setHasSupported(true);
      toast.success("Support recorded locally!");
    } finally {
      setIsSupporting(false);
    }
  }

  if (!complaint) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-display font-bold text-foreground mb-2">Petition Not Found</p>
          <Link to="/citizen/petitions" className="text-navy-600 dark:text-navy-300 hover:underline font-medium">Back to My Petitions</Link>
        </div>
      </div>
    );
  }

  function submitFeedback() {
    if (!rating) return;
    updateComplaint(complaint!.id, {
      feedback: { rating, comment: feedbackText, submittedAt: new Date().toISOString() },
    });
    setFeedbackSubmitted(true);
  }

  function reopenComplaint() {
    updateComplaint(complaint!.id, {
      status: "submitted",
      reopenCount: complaint!.reopenCount + 1,
      statusHistory: [
        ...complaint!.statusHistory,
        { status: "submitted", timestamp: new Date().toISOString(), note: "Petition reopened by citizen — resolution unsatisfactory.", updatedBy: user?.name || "Citizen" },
      ],
    });
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Back */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Link to="/citizen/petitions" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors font-medium">
              <ArrowLeft className="w-4 h-4" /> Back to My Petitions
            </Link>
          </motion.div>

          {/* Header Card */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card-doppelrand mb-6"
          >
            <div className="card-doppelrand-inner">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-sm font-mono font-bold text-navy-700 bg-navy-50 dark:bg-navy-900/60 dark:text-navy-200 px-3 py-1 rounded-lg">{complaint.petitionId}</span>
                    <StatusBadge status={complaint.status} />
                    <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border", priorityClass(complaint.priority))}>{complaint.priority.toUpperCase()} PRIORITY</span>
                    <EscalationBadge complaint={complaint} />
                  </div>
                  <h1 className="font-display text-xl font-extrabold text-foreground">{complaint.title}</h1>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={handleReadAloud}
                    className="min-h-[48px] px-4 py-2 border-2 border-blue-900 bg-blue-50 text-blue-900 hover:bg-blue-100 rounded-xl font-bold flex items-center gap-2 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-400"
                    aria-label="Read petition details aloud"
                  >
                    <Volume2 className="w-5 h-5 text-blue-800 dark:text-blue-300" />
                    <span>{isReading ? "Reading aloud..." : "Read this aloud"}</span>
                  </button>
                </div>
              </div>

              {/* SLA Badge */}
              <div className="mb-4">
                <SLABadge complaint={complaint} />
              </div>

              {/* Supporter Count & Issue Too Action */}
              <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-muted/40 rounded-xl border border-border">
                <button
                  type="button"
                  onClick={handleSupport}
                  disabled={hasSupported || isSupporting}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    hasSupported
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                      : "bg-navy-600 text-white hover:bg-navy-700 active:scale-95 shadow-sm"
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  {hasSupported ? "I Have This Issue Too (Supported)" : "I Have This Issue Too"}
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/10 text-[10px] font-bold">
                    {supporterCount}
                  </span>
                </button>
                {complaint.masterPetitionId && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                    <Link2 className="w-3.5 h-3.5 text-navy-600 dark:text-navy-300" />
                    Cluster Master Petition: <strong className="font-mono text-foreground">{complaint.masterPetitionId}</strong>
                  </span>
                )}
              </div>

              {/* Export Buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => generatePetitionPDF(complaint)}
                  className="inline-flex items-center gap-1.5 text-xs bg-red-50 text-red-700 border border-red-200/60 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/60 px-3.5 py-2 rounded-full hover:bg-red-100 transition-all font-medium active:scale-[0.98]"
                >
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </button>
                <button
                  onClick={() => exportSingleComplaintToExcel(complaint)}
                  className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 px-3.5 py-2 rounded-full hover:bg-emerald-100 transition-all font-medium active:scale-[0.98]"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
                </button>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{complaint.description}</p>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                {[
                  { icon: MapPin, label: "Location", value: complaint.location },
                  { icon: Building2, label: "Department", value: complaint.assignedDepartment },
                  { icon: User, label: "Assigned Officer", value: complaint.assignedOfficerName || "Not assigned yet" },
                  { icon: Calendar, label: "Submitted", value: formatDate(complaint.submittedAt) },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-2">
                    <item.icon className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="font-medium text-sm">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* QR Code */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card-doppelrand mb-6"
          >
            <div className="card-doppelrand-inner flex items-center gap-4">
              <QRCode value={`https://petitionai.gov.in/track/${complaint.petitionId}`} size={80} />
              <div>
                <p className="text-sm font-display font-bold text-foreground">Track this petition</p>
                <p className="text-xs text-muted-foreground">Scan QR code or share the petition ID</p>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Status Timeline */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <StatusTimeline currentStatus={complaint.status} history={complaint.statusHistory} />
            </motion.div>

            {/* AI Analysis */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <AIAnalysisCard analysis={complaint.aiAnalysis} compact />
            </motion.div>
          </div>

          {/* Officer Remarks */}
          {complaint.officerRemarks && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card-doppelrand mb-6"
            >
              <div className="card-doppelrand-inner">
                <h3 className="font-display font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-navy-600 dark:text-gold-400" /> Officer Remarks
                </h3>
                <p className="text-sm text-foreground bg-muted/60 dark:bg-gray-800/80 rounded-xl p-4">{complaint.officerRemarks}</p>
                <p className="text-xs text-muted-foreground mt-2">— {complaint.assignedOfficerName}</p>
              </div>
            </motion.div>
          )}

          {/* Resolution Details */}
          {complaint.resolutionDetails && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card-doppelrand mb-6 border-l-4 border-emerald-400"
            >
              <div className="card-doppelrand-inner">
                <h3 className="font-display font-bold text-emerald-700 dark:text-emerald-400 mb-2 text-sm">Resolution Details</h3>
                <p className="text-sm text-foreground">{complaint.resolutionDetails}</p>
                {complaint.resolutionProof && (
                  <p className="text-xs text-muted-foreground mt-2">{complaint.resolutionProof}</p>
                )}
              </div>
            </motion.div>
          )}

          {/* Full AI Analysis */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6"
          >
            <AIAnalysisCard analysis={complaint.aiAnalysis} />
          </motion.div>

          {/* Escalation Timeline */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card-doppelrand mb-6"
          >
            <div className="card-doppelrand-inner">
              <EscalationTimeline complaintId={complaint.id} />
            </div>
          </motion.div>

          {/* Comments */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card-doppelrand mb-6"
          >
            <div className="card-doppelrand-inner">
              <CommentSection petitionId={complaint.id} />
            </div>
          </motion.div>

          {/* Feedback */}
          {complaint.status === "resolved" && !complaint.feedback && !feedbackSubmitted && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card-doppelrand mb-6"
            >
              <div className="card-doppelrand-inner">
                <h3 className="font-display font-bold text-foreground mb-4">Rate the Resolution</h3>
                <div className="flex gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map(s => (
                    <motion.button
                      key={s}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setRating(s)}
                      className={cn("w-10 h-10 rounded-full", rating >= s ? "text-gold-400" : "text-muted-foreground hover:text-gold-300")}
                    >
                      <Star className="w-7 h-7 fill-current" />
                    </motion.button>
                  ))}
                  {rating > 0 && <span className="text-sm text-muted-foreground self-center ml-2">{rating}/5 stars</span>}
                </div>
                <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)} placeholder="Share your experience (optional)..." rows={3}
                  className="w-full bg-muted/50 dark:bg-muted/20 border border-border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 text-foreground transition-all resize-none mb-3" />
                <button onClick={submitFeedback} disabled={!rating} className="btn-primary disabled:opacity-50 text-sm">Submit Feedback</button>
              </div>
            </motion.div>
          )}

          {(complaint.feedback || feedbackSubmitted) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-doppelrand mb-6 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/60"
            >
              <div className="card-doppelrand-inner">
                <p className="text-sm font-display font-bold text-emerald-700 dark:text-emerald-400">Feedback submitted. Thank you!</p>
                {complaint.feedback && (
                  <div className="flex gap-1 mt-2">
                    {[1, 2, 3, 4, 5].map(s => <Star key={s} className={cn("w-4 h-4", s <= complaint.feedback!.rating ? "text-gold-400 fill-gold-400" : "text-muted-foreground")} />)}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Reopen */}
          {complaint.status === "resolved" && complaint.reopenCount < 2 && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={reopenComplaint}
              className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 border border-amber-300 dark:border-amber-800/60 px-5 py-3 rounded-full hover:bg-amber-50 dark:hover:bg-amber-950/40 font-medium"
            >
              <RotateCcw className="w-4 h-4" /> Reopen — Issue Not Resolved
            </motion.button>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
