import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, MapPin, Tag, Brain, Upload, CheckCircle, Loader2, AlertTriangle, X, Image, FileIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useComplaints } from "@/hooks/useComplaints";
import { useNotifications } from "@/hooks/useNotifications";
import { CATEGORIES } from "@/constants/mockData";
import { generateAIAnalysis, generatePetitionId } from "@/lib/utils";
import { Complaint, StatusUpdate } from "@/types";
import AIAnalysisCard from "@/components/features/AIAnalysisCard";
import { analyzeImagesWithAI } from "@/lib/ai/imageAnalysis";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 5;

type Step = "form" | "analyzing" | "result";

interface UploadedFile {
  file: File;
  preview: string;
  base64: string;
}

export default function SubmitPetition() {
  const { user } = useAuth();
  const { addComplaint } = useComplaints();
  const { addNotification } = useNotifications(user?.id);
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("form");
  const [submittedComplaint, setSubmittedComplaint] = useState<Complaint | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    location: "",
    district: "Coimbatore",
  });

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  const validateFile = useCallback((file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Invalid file type: ${file.name}. Only JPG, PNG, and PDF are allowed.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large: ${file.name}. Maximum size is 5MB.`;
    }
    return null;
  }, []);

  const processFile = useCallback((file: File): Promise<UploadedFile> => {
    return new Promise((resolve, reject) => {
      const error = validateFile(file);
      if (error) {
        reject(new Error(error));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const preview = file.type.startsWith("image/") ? base64 : "";
        resolve({ file, preview, base64 });
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }, [validateFile]);

  const handleFiles = useCallback(async (newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const remainingSlots = MAX_FILES - files.length;

    if (fileArray.length > remainingSlots) {
      setFileError(`Maximum ${MAX_FILES} files allowed. You can add ${remainingSlots} more.`);
      return;
    }

    setFileError(null);

    for (const file of fileArray.slice(0, remainingSlots)) {
      try {
        const uploadedFile = await processFile(file);
        setFiles(prev => [...prev, uploadedFile]);
      } catch (err) {
        setFileError(err instanceof Error ? err.message : "Failed to upload file");
      }
    }
  }, [files.length, processFile]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleBrowseClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ALLOWED_TYPES.join(",");
    input.onchange = (ev) => {
      if (ev.target instanceof HTMLInputElement && ev.target.files) {
        handleFiles(ev.target.files);
      }
    };
    input.click();
  }, [handleFiles]);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setFileError(null);
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStep("analyzing");

    await new Promise(r => setTimeout(r, 2200));

    let imageAnalysisResults: string[] = [];
    if (files.length > 0) {
      try {
        imageAnalysisResults = await analyzeImagesWithAI(files.map(f => f.base64));
      } catch (err) {
        console.warn("Image analysis failed:", err);
      }
    }

    const combinedDescription = form.description + 
      (imageAnalysisResults.length > 0 ? "\n\nAI Image Analysis:\n" + imageAnalysisResults.join("\n") : "");

    const aiResult = await generateAIAnalysis(form.title, combinedDescription, form.category, form.location, form.district);
    const petitionId = generatePetitionId();
    const now = new Date().toISOString();

    const statusHistory: StatusUpdate[] = [
      { status: "submitted", timestamp: now, note: "Petition submitted by citizen", updatedBy: "System" },
      {
        status: "under_review",
        timestamp: new Date(Date.now() + 60000).toISOString(),
        note: `AI analysis complete. Classified as ${aiResult.category} (${Math.round(aiResult.categoryConfidence * 100)}% confidence). Routed to ${aiResult.department}.`,
        updatedBy: "AI System",
      },
    ];

    const complaint: Complaint = {
      id: `c_${Date.now()}`,
      petitionId,
      title: form.title,
      description: form.description,
      category: form.category,
      location: form.location,
      district: form.district,
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
      images: files.map(f => f.base64),
    };

    addComplaint(complaint);
    addNotification({
      userId: user?.id || "u1",
      title: "Petition Submitted Successfully",
      message: `Petition ${petitionId} submitted. AI classified as ${aiResult.category}, Priority: ${aiResult.priority.toUpperCase()}.`,
      type: "success",
      isRead: false,
      petitionId,
    });

    setSubmittedComplaint(complaint);
    setStep("result");
    setFiles([]);
  }

  if (step === "analyzing") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="card-base p-10 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-navy-50 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-navy-900/60">
            <Brain className="w-8 h-8 text-navy-700 animate-pulse dark:text-navy-200" />
          </div>
          <h2 className="font-serif text-xl font-bold text-foreground mb-2">AI is Analysing Your Petition</h2>
          <p className="text-muted-foreground text-sm mb-6">Classifying complaint, detecting duplicates, predicting priority and routing to department...</p>
          <div className="space-y-2.5">
            {["Preprocessing complaint text...", "Running NLP classification...", "Checking semantic similarity...", "Predicting priority & sentiment...", "Routing to department..."].map((msg, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin text-navy-500 flex-shrink-0 dark:text-navy-300" />
                {msg}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (step === "result" && submittedComplaint) {
    return (
      <div className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="card-base p-6 mb-6 border-l-4 border-green-500">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
              <div>
                <p className="font-bold text-foreground">Petition Submitted Successfully!</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Petition ID: <span className="font-mono font-bold text-navy-700 dark:text-navy-300">{submittedComplaint.petitionId}</span> · Use this ID to track your complaint.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            <div className="card-base p-4">
              <h3 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-navy-600 dark:text-navy-300" /> Petition Details
              </h3>
              <div className="space-y-2">
                <p className="text-sm"><span className="text-muted-foreground">Title:</span> <span className="font-medium">{submittedComplaint.title}</span></p>
                <p className="text-sm"><span className="text-muted-foreground">Category:</span> <span className="font-medium">{submittedComplaint.category}</span></p>
                <p className="text-sm"><span className="text-muted-foreground">Location:</span> <span className="font-medium">{submittedComplaint.location}</span></p>
                <p className="text-sm"><span className="text-muted-foreground">Department:</span> <span className="font-semibold text-navy-700 dark:text-navy-300">{submittedComplaint.assignedDepartment}</span></p>
                <p className="text-sm"><span className="text-muted-foreground">Status:</span> <span className="font-semibold text-blue-600">Under Review</span></p>
              </div>
            </div>
            <AIAnalysisCard analysis={submittedComplaint.aiAnalysis} compact />
          </div>

          <AIAnalysisCard analysis={submittedComplaint.aiAnalysis} />

          <div className="flex gap-3 mt-6">
            <button onClick={() => navigate(`/citizen/petition/${submittedComplaint.id}`)} className="btn-primary flex items-center gap-2">
              Track This Petition
            </button>
            <button onClick={() => { setStep("form"); setForm({ title: "", description: "", category: "", location: "", district: "Coimbatore" }); }} className="btn-secondary">
              Submit Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="font-serif text-2xl font-bold text-foreground">Submit New Petition</h1>
          <p className="text-muted-foreground text-sm mt-1">Your complaint will be automatically classified and routed by our AI engine.</p>
        </div>

        <div className="card-base p-3 mb-6 flex items-start gap-2 bg-navy-50 border-navy-200 dark:bg-navy-900/50 dark:border-navy-700">
          <Brain className="w-4 h-4 text-navy-600 flex-shrink-0 mt-0.5 dark:text-navy-300" />
          <p className="text-xs text-navy-700 leading-relaxed dark:text-navy-200">
            Our AI will automatically: classify your complaint, detect duplicates, assign priority, analyse sentiment, and route to the correct department.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card-base p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Petition Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={e => update("title", e.target.value)}
              required
              placeholder="Brief title describing the issue"
              className="w-full border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Complaint Category <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <select
                value={form.category}
                onChange={e => update("category", e.target.value)}
                required
                className="w-full border border-border rounded-md pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 appearance-none bg-card text-foreground"
              >
                <option value="">Select a category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Complaint Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={e => update("description", e.target.value)}
              required
              rows={5}
              placeholder="Describe the issue in detail. Include what happened, when it started, and how it is affecting you and others..."
              className="w-full border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">More detail helps the AI analyse more accurately. Min 50 characters recommended.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Location / Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={form.location}
                onChange={e => update("location", e.target.value)}
                required
                placeholder="Street name, landmark, area"
                className="w-full border border-border rounded-md pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">District</label>
            <select
              value={form.district}
              onChange={e => update("district", e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
            >
              {["Coimbatore", "Chennai", "Madurai", "Salem", "Tiruchirappalli", "Tiruppur", "Erode", "Vellore"].map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div
            className={`border-2 rounded-md p-6 transition-colors ${
              dragActive
                ? "border-navy-400 bg-navy-50 dark:border-navy-500 dark:bg-navy-900/40"
                : "border-dashed border-border"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {files.length === 0 ? (
              <div className="text-center">
                <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Supporting images/documents</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Drag & drop or click to upload (JPG, PNG, PDF — max 5MB)
                </p>
                <button
                  type="button"
                  onClick={handleBrowseClick}
                  className="mt-3 text-xs text-navy-600 border border-navy-300 px-3 py-1.5 rounded-md hover:bg-navy-50 transition-colors dark:text-navy-300 dark:border-navy-700 dark:hover:bg-gray-800"
                >
                  Browse Files
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    {files.length}/{MAX_FILES} files uploaded
                  </p>
                  {files.length > 0 && (
                    <button
                      type="button"
                      onClick={clearFiles}
                      className="text-xs text-red-600 hover:underline dark:text-red-400"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 max-h-48 overflow-y-auto">
                  {files.map((uploadedFile, index) => (
                    <div
                      key={index}
                      className="relative group border border-border rounded-md p-2 bg-card"
                    >
                      {uploadedFile.preview ? (
                        <img
                          src={uploadedFile.preview}
                          alt={uploadedFile.file.name}
                          className="w-full h-16 object-cover rounded mb-1"
                        />
                      ) : (
                        <div className="w-full h-16 flex items-center justify-center bg-muted rounded mb-1">
                          <FileIcon className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground truncate" title={uploadedFile.file.name}>
                        {uploadedFile.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(uploadedFile.file.size / 1024).toFixed(1)} KB
                      </p>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                        aria-label="Remove file"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {files.length < MAX_FILES && (
                    <button
                      type="button"
                      onClick={handleBrowseClick}
                      className="border-2 border-dashed border-border rounded-md p-3 flex flex-col items-center justify-center text-center hover:border-navy-400 hover:bg-navy-50 transition-colors dark:hover:border-navy-500 dark:hover:bg-gray-800"
                    >
                      <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">Add more</span>
                    </button>
                  )}
                </div>

                {fileError && (
                  <p className="text-xs text-red-600 flex items-center gap-1 dark:text-red-400">
                    <AlertTriangle className="w-3 h-3" />
                    {fileError}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md dark:bg-amber-950/40 dark:border-amber-800/60">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 dark:text-amber-300" />
            <p className="text-xs text-amber-700 dark:text-amber-300">Submitting false complaints may result in account suspension. Please ensure accuracy.</p>
          </div>

          <button type="submit" className="w-full bg-navy-800 hover:bg-navy-700 text-white font-semibold py-3 rounded-md transition-colors flex items-center justify-center gap-2">
            <Brain className="w-4 h-4" /> Submit & Analyse with AI
          </button>
        </form>
      </div>
    </div>
  );
}
