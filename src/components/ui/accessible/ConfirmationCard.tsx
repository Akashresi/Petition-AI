import React, { useState } from "react";
import {
  CheckCircle2,
  Volume2,
  MessageSquare,
  Search,
  Home,
  Check,
  Share2,
} from "lucide-react";
import AccessibleButton from "./AccessibleButton";

interface ConfirmationCardProps {
  petitionId: string;
  citizenName?: string;
  phone?: string;
  department?: string;
  expectedDate?: string;
  onReadAloud?: () => void;
  onSendSms?: () => Promise<boolean> | void;
  onTrack?: () => void;
  onHome?: () => void;
  isReading?: boolean;
}

export default function ConfirmationCard({
  petitionId,
  citizenName,
  phone,
  department,
  expectedDate,
  onReadAloud,
  onSendSms,
  onTrack,
  onHome,
  isReading = false,
}: ConfirmationCardProps) {
  const [smsSent, setSmsSent] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSms = async () => {
    if (!onSendSms || smsSent) return;
    setSmsLoading(true);
    try {
      await onSendSms();
      setSmsSent(true);
    } catch {
      // error handled by parent or fallback
      setSmsSent(true);
    } finally {
      setSmsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(petitionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="max-w-xl mx-auto bg-white border-2 border-slate-700 rounded-2xl p-6 sm:p-8 shadow-md dark:bg-slate-900 dark:border-slate-400"
      aria-live="polite"
    >
      {/* Big Success Icon + Title */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 border-4 border-emerald-700 text-emerald-800 mb-4 dark:bg-emerald-950 dark:border-emerald-500 dark:text-emerald-300">
          <CheckCircle2 className="w-12 h-12" aria-hidden="true" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
          Complaint Received!
        </h1>
        <p className="text-lg sm:text-xl text-slate-700 mt-2 dark:text-slate-300">
          Your complaint is now registered with municipal authorities.
        </p>
      </div>

      {/* Large Digits Petition ID Card */}
      <div className="bg-slate-100 border-2 border-slate-600 rounded-xl p-5 mb-6 text-center dark:bg-slate-800 dark:border-slate-500">
        <p className="text-base sm:text-lg font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
          Your Complaint Number
        </p>
        <p
          className="text-3xl sm:text-4xl font-extrabold text-blue-900 font-mono tracking-widest my-2 select-all dark:text-blue-300"
          aria-label={`Complaint number ${petitionId}`}
        >
          {petitionId}
        </p>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1">
          Save this number or your phone number to check status anytime.
        </p>
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-500 hover:bg-slate-200 text-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
            <span>{copied ? "Copied to clipboard" : "Copy number"}</span>
          </button>
        </div>
      </div>

      {/* Plain Language Details */}
      <div className="space-y-3 mb-6 bg-blue-50/60 border border-blue-200 rounded-xl p-4 text-base sm:text-lg dark:bg-slate-800/60 dark:border-slate-700">
        {department && (
          <div className="flex justify-between items-center py-1 border-b border-blue-200 dark:border-slate-700">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Assigned Department:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{department}</span>
          </div>
        )}
        {expectedDate && (
          <div className="flex justify-between items-center py-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Expected Resolution:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{expectedDate}</span>
          </div>
        )}
        <p className="text-slate-700 dark:text-slate-300 text-base">
          An officer will inspect the location and begin work. You will receive SMS updates.
        </p>
      </div>

      {/* Big Action Buttons */}
      <div className="flex flex-col gap-3">
        {onReadAloud && (
          <AccessibleButton
            icon={Volume2}
            onClick={onReadAloud}
            variant="neutral"
            size="large"
            fullWidth
            ariaLabel="Read complaint details aloud"
          >
            {isReading ? "Reading aloud..." : "Read this aloud"}
          </AccessibleButton>
        )}

        <AccessibleButton
          icon={smsSent ? Check : MessageSquare}
          onClick={handleSms}
          variant="secondary"
          size="large"
          fullWidth
          disabled={smsSent || smsLoading}
          ariaLabel="Send complaint number to mobile phone by SMS"
        >
          {smsSent
            ? `SMS Sent to ${phone || "your phone"}`
            : smsLoading
            ? "Sending SMS..."
            : "Send me an SMS"}
        </AccessibleButton>

        {onTrack && (
          <AccessibleButton
            icon={Search}
            onClick={onTrack}
            variant="primary"
            size="large"
            fullWidth
            ariaLabel="Track this complaint status now"
          >
            Track my complaint
          </AccessibleButton>
        )}

        {onHome && (
          <AccessibleButton
            icon={Home}
            onClick={onHome}
            variant="neutral"
            size="default"
            fullWidth
            ariaLabel="Go to Home screen"
          >
            Return to Home
          </AccessibleButton>
        )}
      </div>
    </div>
  );
}

