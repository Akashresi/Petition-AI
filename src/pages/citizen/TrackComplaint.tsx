import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Search,
  Volume2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  RotateCcw,
  ArrowLeft,
  Phone,
  FileText,
  UserCheck,
  Wrench,
  AlertTriangle,
} from "lucide-react";
import { useComplaints } from "@/hooks/useComplaints";
import { useLanguage } from "@/lib/i18n";
import { speakText, isSpeaking, stopSpeaking } from "@/lib/tts";
import { Complaint } from "@/types";
import CitizenHeader from "@/components/ui/accessible/CitizenHeader";
import AccessibleButton from "@/components/ui/accessible/AccessibleButton";
import BigTextInput from "@/components/ui/accessible/BigTextInput";
import StatusBadge from "@/components/ui/accessible/StatusBadge";

export default function TrackComplaint() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("query") || "";

  const { complaints } = useComplaints();
  const { t, language } = useLanguage();

  const [query, setQuery] = useState(initialQuery);
  const [matchedComplaint, setMatchedComplaint] = useState<Complaint | null>(null);
  const [searched, setSearched] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const performSearch = React.useCallback((searchTerm: string) => {
    const clean = searchTerm.trim().toLowerCase();
    if (!clean) {
      setErrorMsg("Please enter a complaint number (e.g. PET-2024-001) or a 10-digit mobile number.");
      setMatchedComplaint(null);
      setSearched(true);
      return;
    }

    setErrorMsg(null);
    setSearched(true);

    // 1. Search by petition ID (case insensitive) or id
    let found = complaints.find(
      (c) =>
        c.petitionId.toLowerCase() === clean ||
        c.id.toLowerCase() === clean ||
        c.petitionId.toLowerCase().includes(clean)
    );

    // 2. If not found and input looks like digits/phone, find latest complaint from this phone
    if (!found) {
      const digitsOnly = clean.replace(/\D/g, "");
      if (digitsOnly.length >= 4) {
        found = complaints.find((c) => {
          const complaintRecord = c as unknown as Record<string, unknown>;
          const cPhone = String(complaintRecord.phone || complaintRecord.submittedByPhone || "");
          return cPhone.replace(/\D/g, "").includes(digitsOnly);
        });
      }
    }

    // 3. Fallback: match by title keywords if still not found
    if (!found && clean.length > 3) {
      found = complaints.find((c) => c.title.toLowerCase().includes(clean));
    }

    setMatchedComplaint(found || null);
  }, [complaints]);

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery, performSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  // Plain language status text
  const getPlainStatusText = (status: string) => {
    switch (status) {
      case "submitted":
      case "received":
        return language === "ta"
          ? "உங்கள் புகார் பெறப்பட்டு பதிவு செய்யப்பட்டுள்ளது."
          : language === "hi"
          ? "आपकी शिकायत दर्ज कर ली गई है।"
          : "Your complaint is registered and received by the system.";
      case "under_review":
        return language === "ta"
          ? "உங்கள் புகார் சரிபார்க்கப்படுகிறது."
          : language === "hi"
          ? "आपकी शिकायत की जाँच की जा रही है।"
          : "Your complaint is being checked by our municipal team.";
      case "assigned":
      case "in_progress":
        return language === "ta"
          ? "உங்கள் புகார் அதிகாரியிடம் உள்ளது. வேலை நடக்கிறது."
          : language === "hi"
          ? "आपकी शिकायत अधिकारी के पास है। काम चल रहा है।"
          : "Your complaint is with the officer. Work is in progress.";
      case "resolved":
      case "closed":
        return language === "ta"
          ? "உங்கள் புகார் தீர்க்கப்பட்டுவிட்டது."
          : language === "hi"
          ? "आपकी शिकायत का समाधान हो गया है।"
          : "Your complaint has been successfully resolved.";
      case "escalated":
        return language === "ta"
          ? "உங்கள் புகார் உயர் அதிகாரியிடம் அனுப்பப்பட்டுள்ளது."
          : language === "hi"
          ? "आपकी शिकायत वरिष्ठ अधिकारी को भेज दी गई है।"
          : "Your complaint was escalated to a senior municipal officer for immediate action.";
      default:
        return "Your complaint is being processed.";
    }
  };

  // Plain language Expected Date
  const getExpectedDateText = (c: Complaint) => {
    const submissionTime = new Date(c.submittedAt).getTime();
    const hours =
      c.priority === "critical"
        ? 24
        : c.priority === "high"
        ? 72
        : c.priority === "medium"
        ? 168
        : 336;
    const deadline = new Date(submissionTime + hours * 3600 * 1000);
    return deadline.toLocaleDateString(language === "ta" ? "ta-IN" : language === "hi" ? "hi-IN" : "en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Read status aloud (Task 3.3)
  const handleReadAloud = () => {
    if (!matchedComplaint) return;
    if (isSpeaking()) {
      stopSpeaking();
      setIsReading(false);
      return;
    }

    const plainStatus = getPlainStatusText(matchedComplaint.status);
    const expected = getExpectedDateText(matchedComplaint);
    const textToRead =
      language === "ta"
        ? `மனு எண் ${matchedComplaint.petitionId}. ${plainStatus} எதிர்பார்க்கப்படும் தீர்வு நாள் ${expected}.`
        : language === "hi"
        ? `शिकायत संख्या ${matchedComplaint.petitionId}। ${plainStatus} अपेक्षित समाधान तिथि ${expected} है।`
        : `Complaint number ${matchedComplaint.petitionId}. ${plainStatus} Expected resolution date is ${expected}.`;

    setIsReading(true);
    speakText(
      textToRead,
      language,
      () => setIsReading(false),
      () => setIsReading(false)
    );
  };

  // Simple 4-stage vertical timeline (Icon + word per step)
  const TIMELINE_STAGES = [
    { key: "submitted", label: "1. Received", icon: Clock },
    { key: "under_review", label: "2. Checked", icon: FileText },
    { key: "in_progress", label: "3. With Officer", icon: Wrench },
    { key: "resolved", label: "4. Resolved", icon: CheckCircle2 },
  ];

  const getStageIndex = (status: string) => {
    if (status === "resolved" || status === "closed") return 3;
    if (status === "in_progress" || status === "assigned" || status === "escalated") return 2;
    if (status === "under_review") return 1;
    return 0;
  };

  return (
    <div className="min-h-screen bg-navy-975 text-foreground pb-12">
      <CitizenHeader
        title={t("citizen.trackComplaint", "Track my complaint")}
        showBack={true}
        onBack={() => navigate("/citizen")}
      />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Search Box Card */}
        <div className="card-reference p-6 bg-surface-card border-surface-border">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-2">
            {t("citizen.trackBy", "Find by Complaint Number or Mobile Phone")}
          </h1>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 mb-4">
            Enter your petition number (e.g. PET-2024-001) or your 10-digit mobile number.
          </p>

          <form onSubmit={handleSearchSubmit} className="space-y-4">
            <BigTextInput
              id="track-search-input"
              label="Complaint Number or Mobile Number"
              value={query}
              onChange={(val) => {
                setQuery(val);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="E.g. PET-2024-001 or 9876543210"
              error={errorMsg || undefined}
              required
            />

            <AccessibleButton
              icon={Search}
              type="submit"
              variant="primary"
              size="large"
              fullWidth
              ariaLabel="Search for complaint status"
            >
              {t("citizen.trackBtn", "Check Status")}
            </AccessibleButton>
          </form>
        </div>

        {/* Results Section */}
        {searched && (
          <div>
            {!matchedComplaint ? (
              <div
                className="card-reference p-6 text-center bg-surface-card border-surface-border space-y-4"
                role="alert"
              >
                <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-800 border-2 border-amber-400 flex items-center justify-center mx-auto dark:bg-amber-950/60 dark:text-amber-300">
                  <AlertCircle className="w-9 h-9" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    No Complaint Found
                  </h2>
                  <p className="text-lg text-slate-600 dark:text-slate-300 mt-2">
                    {t(
                      "citizen.errorOccurred",
                      "Something went wrong. Please check details and try again."
                    )}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    Check if you entered the correct complaint number or mobile number.
                  </p>
                </div>
                <AccessibleButton
                  icon={RotateCcw}
                  onClick={() => setQuery("")}
                  variant="secondary"
                  size="default"
                >
                  {t("citizen.retry", "Try Again")}
                </AccessibleButton>
              </div>
            ) : (
              <div className="bg-white border-2 border-slate-600 rounded-2xl p-6 sm:p-8 shadow-md dark:bg-slate-900 dark:border-slate-400 space-y-6">
                {/* Header: Large ID and Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-slate-200 dark:border-slate-700">
                  <div>
                    <span className="text-sm font-bold uppercase tracking-wider text-slate-500">
                      Complaint Number
                    </span>
                    <h2 className="text-3xl font-extrabold font-mono text-blue-900 dark:text-blue-300">
                      {matchedComplaint.petitionId}
                    </h2>
                  </div>
                  <StatusBadge status={matchedComplaint.status} size="large" />
                </div>

                {/* Plain words status announcement */}
                <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4 dark:bg-blue-950/40 dark:border-blue-700">
                  <h3 className="text-xl font-bold text-blue-950 dark:text-blue-100">
                    {getPlainStatusText(matchedComplaint.status)}
                  </h3>
                  <p className="text-base text-blue-900 dark:text-blue-200 mt-1">
                    {t("citizen.expectedDate", "Expected resolution date")}:{" "}
                    <strong className="underline">{getExpectedDateText(matchedComplaint)}</strong>
                  </p>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                    {matchedComplaint.title}
                  </h3>
                  <p className="text-base sm:text-lg text-slate-700 dark:text-slate-300 mt-2 whitespace-pre-wrap">
                    {matchedComplaint.description}
                  </p>
                </div>

                {/* Key Details in Plain Words */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-base">
                  <div className="bg-slate-100 p-3 rounded-xl border border-slate-300 dark:bg-slate-800 dark:border-slate-700">
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-400 block">
                      {t("citizen.assignedDept", "Department in charge")}:
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-lg">
                      {matchedComplaint.assignedDepartment || "Municipal Corporation"}
                    </span>
                  </div>

                  <div className="bg-slate-100 p-3 rounded-xl border border-slate-300 dark:bg-slate-800 dark:border-slate-700">
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-400 block">
                      {t("citizen.assignedOfficer", "Assigned officer")}:
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-lg">
                      {matchedComplaint.assignedOfficerName || "Area Ward Officer"}
                    </span>
                  </div>
                </div>

                {/* Simple Vertical Timeline (Icon + Word per step) */}
                <div className="pt-4 border-t-2 border-slate-200 dark:border-slate-700">
                  <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
                    Progress Timeline
                  </h4>

                  <div className="space-y-4">
                    {TIMELINE_STAGES.map((stg, idx) => {
                      const currentActiveIdx = getStageIndex(matchedComplaint.status);
                      const isComplete = idx <= currentActiveIdx;
                      const isCurrent = idx === currentActiveIdx;
                      const Icon = stg.icon;

                      return (
                        <div key={stg.key} className="flex items-center gap-4">
                          <div
                            className={`
                              w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border-2 font-bold
                              ${
                                isComplete
                                  ? "bg-emerald-100 text-emerald-900 border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-slate-100 text-slate-400 border-slate-300 dark:bg-slate-800 dark:border-slate-700"
                              }
                              ${isCurrent ? "ring-4 ring-blue-300 dark:ring-blue-700" : ""}
                            `}
                          >
                            <Icon className="w-6 h-6" />
                          </div>
                          <div>
                            <span
                              className={`text-lg font-bold ${
                                isComplete
                                  ? "text-slate-900 dark:text-slate-100"
                                  : "text-slate-400 dark:text-slate-500"
                              }`}
                            >
                              {stg.label}
                            </span>
                            {isCurrent && (
                              <span className="block text-sm font-semibold text-blue-800 dark:text-blue-400">
                                Current stage
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons: Read aloud & Back */}
                <div className="pt-4 flex flex-col gap-3">
                  <AccessibleButton
                    icon={Volume2}
                    onClick={handleReadAloud}
                    variant="neutral"
                    size="large"
                    fullWidth
                    ariaLabel="Read status aloud in your language"
                  >
                    {isReading
                      ? t("citizen.readingAloud", "Reading aloud...")
                      : t("citizen.readAloud", "Read this aloud")}
                  </AccessibleButton>

                  <AccessibleButton
                    icon={ArrowLeft}
                    onClick={() => navigate("/citizen")}
                    variant="secondary"
                    size="default"
                    fullWidth
                  >
                    {t("citizen.back", "Return to Home")}
                  </AccessibleButton>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
