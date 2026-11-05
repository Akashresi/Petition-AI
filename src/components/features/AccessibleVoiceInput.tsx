import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, AlertCircle, Volume2 } from "lucide-react";
import BigTextInput from "@/components/ui/accessible/BigTextInput";

interface AccessibleVoiceInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  language: string; // 'ta', 'hi', 'en'
  placeholder?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
}

// Minimal typing for Web Speech API
interface SpeechRecognitionEvent {
  results: {
    length: number;
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface IWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
}

export default function AccessibleVoiceInput({
  id,
  label,
  value,
  onChange,
  language,
  placeholder,
  helperText,
  error,
  required = false,
}: AccessibleVoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Keep latest onChange in ref so effect doesn't re-run on parent re-renders
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Map app language to speech recognition BCP-47 locale
  const getRecognitionLang = (lang: string) => {
    switch (lang) {
      case "ta":
        return "ta-IN";
      case "hi":
        return "hi-IN";
      default:
        return "en-IN";
    }
  };

  useEffect(() => {
    const win = typeof window !== "undefined" ? (window as unknown as IWindow) : null;
    const SpeechRecognition = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = getRecognitionLang(language);

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript + " ";
        }
        if (transcript.trim()) {
          onChangeRef.current(transcript.trim());
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.warn("[SpeechRecognition] error:", event.error);
        setIsListening(false);
        if (event.error === "not-allowed") {
          setSpeechError("Microphone permission was denied. You can type your problem below.");
        } else if (event.error !== "no-speech") {
          setSpeechError("Voice input paused. Tap the microphone to try again or type below.");
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.warn("[SpeechRecognition] initialization failed:", e);
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // cleanup
        }
      }
    };
  }, [language]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        // stopped
      }
      setIsListening(false);
    } else {
      setSpeechError(null);
      try {
        recognitionRef.current.lang = getRecognitionLang(language);
        recognitionRef.current.start();
      } catch (err) {
        console.warn("[SpeechRecognition] start error:", err);
        try {
          recognitionRef.current.abort();
          recognitionRef.current.start();
        } catch {
          setSpeechError("Unable to start microphone. Please type your message.");
        }
      }
    }
  };

  const getMicButtonLabel = () => {
    if (isListening) {
      switch (language) {
        case "ta":
          return "கேட்கிறது... பேசவும் (நிறுத்த அழுத்தவும்)";
        case "hi":
          return "सुन रहा हूँ... बोलें (रोकने के लिए दबाएँ)";
        default:
          return "Listening... Speak now (Tap to stop)";
      }
    } else {
      switch (language) {
        case "ta":
          return "மைக்ரோஃபோனைத் தொட்டுப் பேசுங்கள்";
        case "hi":
          return "बोलने के लिए माइक दबाएँ";
        default:
          return "Tap to Speak";
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Big Microphone Action Button */}
      {isSupported ? (
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={toggleListening}
            className={`
              w-full min-h-[64px] sm:min-h-[72px] px-6 py-4 rounded-2xl border-4 font-extrabold text-lg sm:text-xl
              flex items-center justify-center gap-4 transition-all cursor-pointer shadow-md select-none
              focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 active:scale-98
              ${
                isListening
                  ? "bg-rose-700 text-white border-rose-900 animate-pulse dark:bg-rose-800 dark:border-rose-600"
                  : "bg-blue-800 text-white border-blue-950 hover:bg-blue-900 dark:bg-blue-700 dark:border-blue-500 dark:hover:bg-blue-800"
              }
            `}
            aria-pressed={isListening}
            aria-label={getMicButtonLabel()}
          >
            {isListening ? (
              <MicOff className="w-8 h-8 shrink-0 text-white" aria-hidden="true" />
            ) : (
              <Mic className="w-8 h-8 shrink-0 text-amber-300" aria-hidden="true" />
            )}
            <span className="leading-tight text-center">{getMicButtonLabel()}</span>
          </button>

          {isListening && (
            <p className="text-base sm:text-lg font-bold text-rose-800 dark:text-rose-300 mt-2 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
              <span>Recording voice in {language === "ta" ? "தமிழ்" : language === "hi" ? "हिन्दी" : "English"}...</span>
            </p>
          )}

          {speechError && (
            <div className="mt-3 p-3 bg-amber-50 border-2 border-amber-600 rounded-xl text-amber-950 text-base flex items-start gap-2 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-700 mt-0.5" />
              <span>{speechError}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="p-3 bg-slate-100 border-2 border-slate-400 rounded-xl text-slate-800 text-base flex items-center gap-3 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200">
          <AlertCircle className="w-5 h-5 text-slate-600 shrink-0" />
          <span>
            {language === "ta"
              ? "குரல் பதிவு இந்த உலாவியில் ஆதரிக்கப்படவில்லை. கீழே உள்ள பெட்டியில் தட்டச்சு செய்யவும்."
              : language === "hi"
              ? "इस ब्राउज़र में वॉयस इनपुट समर्थित नहीं है। कृपया नीचे टाइप करें।"
              : "Voice input is not supported in this browser. Please type your message below."}
          </span>
        </div>
      )}

      {/* Editable Large Text Box */}
      <BigTextInput
        id={id}
        label={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        helperText={helperText}
        error={error}
        multiline
        rows={5}
        required={required}
      />
    </div>
  );
}
