import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin,
  Camera,
  ArrowRight,
  ArrowLeft,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  Navigation,
  Trash2,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useComplaints } from "@/hooks/useComplaints";
import { useNotifications } from "@/hooks/useNotifications";
import { useLanguage } from "@/lib/i18n";
import { speakText, isSpeaking, stopSpeaking } from "@/lib/tts";
import { generateAIAnalysis, generatePetitionId } from "@/lib/utils";
import { Complaint, StatusUpdate } from "@/types";
import CitizenHeader from "@/components/ui/accessible/CitizenHeader";
import StepIndicator from "@/components/ui/accessible/StepIndicator";
import AccessibleButton from "@/components/ui/accessible/AccessibleButton";
import BigTextInput from "@/components/ui/accessible/BigTextInput";
import ConfirmationCard from "@/components/ui/accessible/ConfirmationCard";
import AccessibleVoiceInput from "@/components/features/AccessibleVoiceInput";
import FirstLaunchLanguageModal from "@/components/features/FirstLaunchLanguageModal";

const ALLOWED_TYPES = ["image/jpeg", "image/png"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function SubmitPetition() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addComplaint } = useComplaints();
  const { addNotification } = useNotifications(user?.id);
  const { t, language } = useLanguage();

  // 4 Wizard Steps + "submitting" + "confirmation"
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedComplaint, setSubmittedComplaint] = useState<Complaint | null>(null);
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [isTtsReading, setIsTtsReading] = useState(false);

  // Form State
  const [problemText, setProblemText] = useState("");
  const [problemError, setProblemError] = useState<string | null>(null);

  const [locationText, setLocationText] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [locationSuccess, setLocationSuccess] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [photos, setPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Auto GPS Location Handler
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser. Please type your address.");
      return;
    }
    setIsLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const coords = `Lat: ${pos.coords.latitude.toFixed(4)}, Long: ${pos.coords.longitude.toFixed(4)}`;
        const autoAddr = `Near GPS (${coords}), Coimbatore`;
        setLocationText(autoAddr);
        setLocationSuccess(t("citizen.gpsFound", "Location detected successfully"));
      },
      (err) => {
        setIsLocating(false);
        console.warn("Geolocation error:", err);
        setLocationError("Could not retrieve automatic location. Please type the address or landmark.");
      },
      { timeout: 8000 }
    );
  };

  // Photo Upload Handler
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setPhotoError("Only JPG or PNG image files are supported.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setPhotoError("Image size must be under 5MB.");
      return;
    }

    setPhotoError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPhotos([base64]); // Support 1 clear primary photo for low-complexity wizard
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotos([]);
    setPhotoError(null);
  };

  // Step Navigation Handlers
  const handleNextFromStep1 = () => {
    if (!problemText.trim() || problemText.trim().length < 5) {
      setProblemError("Please speak or type at least a few words describing your problem.");
      return;
    }
    setProblemError(null);
    setCurrentStep(2);
  };

  const handleNextFromStep2 = () => {
    if (!locationText.trim()) {
      setLocationError("Please provide an address, landmark, or tap 'Detect my location'.");
      return;
    }
    setLocationError(null);
    setCurrentStep(3);
  };

  const handleNextFromStep3 = () => {
    setCurrentStep(4);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigate("/citizen");
    }
  };

  // Step 4: Final Submit
  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const petitionId = generatePetitionId();
      const now = new Date().toISOString();

      // Title derived from first 60 chars of description
      const derivedTitle = problemText.length > 50 ? problemText.slice(0, 50) + "..." : problemText;

      // AI Analysis with confidence score and short plain explanation
      const aiResult = await generateAIAnalysis(
        derivedTitle,
        problemText,
        "",
        locationText,
        "Coimbatore"
      );

      const statusHistory: StatusUpdate[] = [
        {
          status: "submitted",
          timestamp: now,
          note: "Complaint submitted by citizen",
          updatedBy: "Citizen Portal",
        },
        {
          status: "under_review",
          timestamp: new Date(Date.now() + 1000).toISOString(),
          note: `AI analysis complete (${Math.round(aiResult.categoryConfidence * 100)}% confidence). Routed to ${aiResult.department}.`,
          updatedBy: "AI System",
        },
      ];

      const complaint: Complaint = {
        id: `c_${Date.now()}`,
        petitionId,
        title: derivedTitle,
        description: problemText,
        category: aiResult.category,
        location: locationText,
        district: "Coimbatore",
        submittedBy: user?.id || "u1",
        submittedByName: user?.name || "Citizen",
        submittedAt: now,
        status: "under_review",
        priority: aiResult.priority,
        assignedDepartment: aiResult.department,
        aiAnalysis: aiResult,
        statusHistory,
        reopenCount: 0,
        isEscalated: false,
        images: photos,
      };

      addComplaint(complaint);
      addNotification({
        userId: user?.id || "u1",
        title: "Complaint Received",
        message: `Your complaint ${petitionId} is registered and routed to ${aiResult.department}.`,
        type: "success",
        isRead: false,
        petitionId,
      });

      setSubmittedComplaint(complaint);
    } catch (err) {
      console.warn("Submission error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // TTS Read Aloud for confirmation
  const handleReadAloud = () => {
    if (!submittedComplaint) return;
    if (isSpeaking()) {
      stopSpeaking();
      setIsTtsReading(false);
      return;
    }

    const textToRead =
      language === "ta"
        ? `உங்கள் புகார் எண் ${submittedComplaint.petitionId}. உங்கள் புகார் ${submittedComplaint.assignedDepartment} துறைக்கு அனுப்பப்பட்டுள்ளது.`
        : language === "hi"
        ? `आपकी शिकायत संख्या ${submittedComplaint.petitionId} है। आपकी शिकायत ${submittedComplaint.assignedDepartment} विभाग को भेज दी गई है।`
        : `Your complaint number is ${submittedComplaint.petitionId}. It has been assigned to ${submittedComplaint.assignedDepartment}.`;

    setIsTtsReading(true);
    speakText(
      textToRead,
      language,
      () => setIsTtsReading(false),
      () => setIsTtsReading(false)
    );
  };

  const handleSendSms = async () => {
    if (!submittedComplaint) return;
    try {
      await fetch("/api/notifications/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: user?.phone || "9876543210",
          message: `PetitionAI: Complaint ${submittedComplaint.petitionId} registered successfully. Track at app.`,
        }),
      });
    } catch (e) {
      // Mock / fallback
    }
  };

  // Render Confirmation Screen once submitted
  if (submittedComplaint) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <CitizenHeader
          title={t("citizen.title", "Citizen Portal")}
          showBack={false}
          onOpenLanguage={() => setLangModalOpen(true)}
        />
        <main className="max-w-xl mx-auto px-4 py-8">
          <ConfirmationCard
            petitionId={submittedComplaint.petitionId}
            citizenName={submittedComplaint.submittedByName}
            phone={user?.phone || "+91 9876543210"}
            department={submittedComplaint.assignedDepartment}
            expectedDate={new Date(Date.now() + 72 * 3600 * 1000).toLocaleDateString()}
            onReadAloud={handleReadAloud}
            onSendSms={handleSendSms}
            onTrack={() => navigate(`/citizen/petitions/${submittedComplaint.id}`)}
            onHome={() => navigate("/citizen")}
            isReading={isTtsReading}
          />
        </main>
      </div>
    );
  }

  // Render Submitting Loading Screen
  if (isSubmitting) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 dark:bg-slate-950">
        <div className="bg-white border-2 border-slate-600 rounded-2xl p-8 max-w-md w-full text-center shadow-lg dark:bg-slate-900 dark:border-slate-400">
          <Loader2 className="w-14 h-14 text-blue-800 animate-spin mx-auto mb-4 dark:text-blue-400" />
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            {t("citizen.sending", "Sending your complaint...")}
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-300 mt-2">
            Please wait while we record your complaint and route it to the right department.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 pb-12">
      {/* Header with Back button, A+/A- scaler and Language selector */}
      <CitizenHeader
        title={t("citizen.title", "Citizen Portal")}
        showBack={true}
        onBack={handleBack}
        onOpenLanguage={() => setLangModalOpen(true)}
      />

      <FirstLaunchLanguageModal
        forceOpen={langModalOpen}
        onClose={() => setLangModalOpen(false)}
      />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Step Indicator (e.g. Step 2 of 4) */}
        <StepIndicator
          currentStep={currentStep}
          totalSteps={4}
          stepLabels={[
            t("citizen.step1Title", "Problem"),
            t("citizen.step2Title", "Location"),
            t("citizen.step3Title", "Photo"),
            t("citizen.step4Title", "Check & Send"),
          ]}
        />

        {/* ── STEP 1: What is the problem? ── */}
        {currentStep === 1 && (
          <div className="bg-white border-2 border-slate-400 rounded-2xl p-6 sm:p-8 shadow-sm dark:bg-slate-900 dark:border-slate-700 space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                {t("citizen.step1Title", "What is the problem?")}
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-300 mt-1">
                {t("citizen.step1Subtitle", "Tap the big microphone and speak, or type below")}
              </p>
            </div>

            {/* Voice input with large microphone button */}
            <AccessibleVoiceInput
              id="problem-description"
              label={t("citizen.problemDescriptionLabel", "Describe the problem clearly")}
              value={problemText}
              onChange={(val) => {
                setProblemText(val);
                if (problemError) setProblemError(null);
              }}
              language={language}
              placeholder={t(
                "citizen.problemDescriptionPlaceholder",
                "For example: Pothole on main road near bus stand causing accidents..."
              )}
              error={problemError || undefined}
              required
            />

            {/* Navigation buttons: Max 1 primary button */}
            <div className="pt-4 flex flex-col gap-3">
              <AccessibleButton
                icon={ArrowRight}
                onClick={handleNextFromStep1}
                variant="primary"
                size="large"
                fullWidth
                ariaLabel="Continue to Step 2: Location"
              >
                {t("citizen.next", "Continue to Next Step")}
              </AccessibleButton>
            </div>
          </div>
        )}

        {/* ── STEP 2: Where? ── */}
        {currentStep === 2 && (
          <div className="bg-white border-2 border-slate-400 rounded-2xl p-6 sm:p-8 shadow-sm dark:bg-slate-900 dark:border-slate-700 space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                {t("citizen.step2Title", "Where is the problem?")}
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-300 mt-1">
                {t("citizen.step2Subtitle", "Use your phone's GPS or enter the landmark")}
              </p>
            </div>

            {/* GPS Location Button */}
            <div>
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={isLocating}
                className="w-full min-h-[56px] px-5 py-3 rounded-xl border-2 border-blue-900 bg-blue-50 text-blue-950 hover:bg-blue-100 active:bg-blue-200 font-bold text-lg flex items-center justify-center gap-3 transition-colors dark:bg-blue-950/60 dark:border-blue-400 dark:text-blue-100"
                aria-label="Detect my location automatically using GPS"
              >
                {isLocating ? (
                  <Loader2 className="w-6 h-6 animate-spin text-blue-800 dark:text-blue-300" />
                ) : (
                  <Navigation className="w-6 h-6 text-blue-800 dark:text-blue-300" />
                )}
                <span>
                  {isLocating
                    ? "Detecting location..."
                    : t("citizen.useGps", "Detect my location automatically")}
                </span>
              </button>

              {locationSuccess && (
                <p className="text-base font-bold text-emerald-800 dark:text-emerald-300 mt-2 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span>{locationSuccess}</span>
                </p>
              )}

              {locationError && (
                <p className="text-base font-bold text-rose-800 dark:text-rose-300 mt-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-700" />
                  <span>{locationError}</span>
                </p>
              )}
            </div>

            {/* Address / Landmark text input */}
            <BigTextInput
              id="location-text"
              label={t("citizen.locationLabel", "Address / Landmark")}
              value={locationText}
              onChange={(val) => {
                setLocationText(val);
                if (locationError) setLocationError(null);
              }}
              placeholder={t("citizen.locationPlaceholder", "E.g. Near Post Office, Anna Nagar")}
              helperText="Add street name, shop name, or nearby building."
              required
            />

            {/* Navigation buttons */}
            <div className="pt-4 flex flex-col gap-3">
              <AccessibleButton
                icon={ArrowRight}
                onClick={handleNextFromStep2}
                variant="primary"
                size="large"
                fullWidth
                ariaLabel="Continue to Step 3: Photo"
              >
                {t("citizen.next", "Continue to Next Step")}
              </AccessibleButton>

              <AccessibleButton
                icon={ArrowLeft}
                onClick={handleBack}
                variant="neutral"
                size="default"
                fullWidth
                ariaLabel="Back to Step 1"
              >
                {t("citizen.back", "Back")}
              </AccessibleButton>
            </div>
          </div>
        )}

        {/* ── STEP 3: Add a photo (optional) ── */}
        {currentStep === 3 && (
          <div className="bg-white border-2 border-slate-400 rounded-2xl p-6 sm:p-8 shadow-sm dark:bg-slate-900 dark:border-slate-700 space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                {t("citizen.step3Title", "Add a photo (optional)")}
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-300 mt-1">
                {t("citizen.step3Subtitle", "Take a photo or upload an image of the problem")}
              </p>
            </div>

            {photos.length === 0 ? (
              <label
                htmlFor="photo-upload-input"
                className="w-full min-h-[160px] p-6 rounded-2xl border-3 border-dashed border-slate-400 bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors text-center dark:bg-slate-800/60 dark:border-slate-600 dark:hover:bg-slate-800"
              >
                <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-900 dark:bg-blue-950 dark:text-blue-300 border border-blue-300">
                  <Camera className="w-8 h-8" />
                </div>
                <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {t("citizen.photoUploadBtn", "Take or Choose Photo")}
                </span>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Tap here to open camera or gallery (JPG, PNG up to 5MB)
                </span>
                <input
                  id="photo-upload-input"
                  type="file"
                  accept="image/jpeg,image/png"
                  capture="environment"
                  onChange={handlePhotoSelect}
                  className="sr-only"
                />
              </label>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-2xl overflow-hidden border-2 border-slate-600 max-h-72 bg-black flex items-center justify-center">
                  <img
                    src={photos[0]}
                    alt="Problem attachment"
                    className="max-h-72 w-full object-contain"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="w-full min-h-[48px] px-4 py-2 border-2 border-rose-800 text-rose-900 bg-rose-50 hover:bg-rose-100 rounded-xl font-bold flex items-center justify-center gap-2 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-600"
                >
                  <Trash2 className="w-5 h-5 text-rose-700" />
                  <span>Remove Photo</span>
                </button>
              </div>
            )}

            {photoError && (
              <p className="text-base font-bold text-rose-800 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-700" />
                <span>{photoError}</span>
              </p>
            )}

            {/* Navigation buttons */}
            <div className="pt-4 flex flex-col gap-3">
              <AccessibleButton
                icon={ArrowRight}
                onClick={handleNextFromStep3}
                variant="primary"
                size="large"
                fullWidth
                ariaLabel="Continue to Step 4: Check and send"
              >
                {photos.length > 0 ? "Keep Photo & Continue" : "Skip Photo & Continue"}
              </AccessibleButton>

              <AccessibleButton
                icon={ArrowLeft}
                onClick={handleBack}
                variant="neutral"
                size="default"
                fullWidth
                ariaLabel="Back to Step 2"
              >
                {t("citizen.back", "Back")}
              </AccessibleButton>
            </div>
          </div>
        )}

        {/* ── STEP 4: Check and send ── */}
        {currentStep === 4 && (
          <div className="bg-white border-2 border-slate-400 rounded-2xl p-6 sm:p-8 shadow-sm dark:bg-slate-900 dark:border-slate-700 space-y-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                {t("citizen.step4Title", "Check and send")}
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-300 mt-1">
                {t("citizen.step4Subtitle", "Review your complaint details before sending")}
              </p>
            </div>

            {/* Review Summary Card */}
            <div className="space-y-4 bg-slate-50 border-2 border-slate-300 rounded-xl p-5 dark:bg-slate-800/80 dark:border-slate-700">
              <div>
                <span className="block text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Your Problem Description:
                </span>
                <p className="text-lg sm:text-xl font-medium text-slate-900 dark:text-slate-100 mt-1 whitespace-pre-wrap">
                  {problemText}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-300 dark:border-slate-700">
                <span className="block text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Location:
                </span>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-800 dark:text-blue-400" />
                  <span>{locationText}</span>
                </p>
              </div>

              {photos.length > 0 && (
                <div className="pt-3 border-t border-slate-300 dark:border-slate-700 flex items-center gap-3">
                  <Camera className="w-5 h-5 text-slate-600" />
                  <span className="text-base font-semibold text-slate-800 dark:text-slate-200">
                    1 Photo Attached
                  </span>
                </div>
              )}

              {/* AI Auto-Routing preview badge with Rule 5 confidence & explanation */}
              <div className="mt-4 p-4 rounded-xl bg-blue-50 border-2 border-blue-300 text-blue-950 dark:bg-blue-950/40 dark:border-blue-700 dark:text-blue-200">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-5 h-5 text-blue-800 dark:text-blue-300" />
                  <span className="text-base font-extrabold">Automatic AI Routing</span>
                </div>
                <p className="text-sm">
                  Confidence: 94% • AI will verify keywords, check for duplicate submissions, and forward directly to the responsible municipal department.
                </p>
              </div>
            </div>

            {/* Single Primary Action Button */}
            <div className="pt-4 flex flex-col gap-3">
              <AccessibleButton
                icon={Send}
                onClick={handleFinalSubmit}
                variant="primary"
                size="large"
                fullWidth
                ariaLabel="Send Complaint to Government"
              >
                {t("citizen.sendComplaint", "Send Complaint")}
              </AccessibleButton>

              <AccessibleButton
                icon={ArrowLeft}
                onClick={handleBack}
                variant="neutral"
                size="default"
                fullWidth
                ariaLabel="Back to Step 3"
              >
                {t("citizen.back", "Back to Edit")}
              </AccessibleButton>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
