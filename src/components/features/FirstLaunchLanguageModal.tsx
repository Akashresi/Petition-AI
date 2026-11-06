import React, { useState, useEffect } from "react";
import { Languages, CheckCircle } from "lucide-react";
import { useLanguage, SUPPORTED_LANGUAGES } from "@/lib/i18n";

interface FirstLaunchLanguageModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export default function FirstLaunchLanguageModal({
  forceOpen = false,
  onClose,
}: FirstLaunchLanguageModalProps) {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      return;
    }
    const chosen = localStorage.getItem("petitionai_lang_chosen");
    if (!chosen) {
      // First launch detected! Open prompt
      setIsOpen(true);
    }
  }, [forceOpen]);

  if (!isOpen) return null;

  const handleSelect = (code: string) => {
    setLanguage(code);
    setIsOpen(false);
    if (onClose) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="language-modal-title"
    >
      <div className="w-full max-w-md bg-white border-4 border-blue-900 rounded-3xl p-6 sm:p-8 shadow-2xl dark:bg-slate-900 dark:border-blue-500 animate-in fade-in zoom-in-95 duration-200">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-100 text-blue-900 mb-3 dark:bg-blue-950 dark:text-blue-200 border-2 border-blue-300">
            <Languages className="w-10 h-10" aria-hidden="true" />
          </div>
          <h2
            id="language-modal-title"
            className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100"
          >
            Choose Your Language
          </h2>
          <p className="text-lg text-slate-700 dark:text-slate-300 mt-1 font-semibold">
            மொழியைத் தேர்ந்தெடுக்கவும் / भाषा चुनें
          </p>
        </div>

        {/* Big Buttons Showing Each Language In Its Own Script */}
        <div className="flex flex-col gap-4">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = language === lang.code;

            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelect(lang.code)}
                className={`
                  w-full min-h-[64px] px-6 py-4 rounded-2xl border-4 text-left font-bold
                  flex items-center justify-between transition-all select-none
                  cursor-pointer active:scale-98
                  focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400
                  ${
                    isSelected
                      ? "border-blue-900 bg-blue-100 text-blue-950 dark:border-blue-400 dark:bg-blue-950/80 dark:text-blue-100"
                      : "border-slate-400 bg-slate-50 text-slate-900 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  }
                `}
                aria-label={`Select ${lang.name} (${lang.script})`}
              >
                <div>
                  <span className="block text-2xl sm:text-3xl font-extrabold tracking-wide">
                    {lang.script}
                  </span>
                  <span className="block text-sm sm:text-base font-semibold text-slate-600 dark:text-slate-300">
                    {lang.name}
                  </span>
                </div>
                {isSelected && (
                  <CheckCircle className="w-8 h-8 text-blue-900 dark:text-blue-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

