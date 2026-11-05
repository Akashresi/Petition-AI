import React from "react";
import { ArrowLeft, Languages, Home, LogOut, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import TextSizeControl from "./TextSizeControl";
import { useLanguage } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

interface CitizenHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  onOpenLanguage?: () => void;
}

export default function CitizenHeader({
  title = "PetitionAI",
  subtitle,
  showBack,
  onBack,
  onOpenLanguage,
}: CitizenHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage } = useLanguage();
  const { user, logout } = useAuth();

  const isHome = location.pathname === "/citizen" || location.pathname === "/";
  const shouldShowBack = showBack ?? !isHome;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate("/citizen");
    }
  };

  const cycleLanguage = () => {
    if (onOpenLanguage) {
      onOpenLanguage();
      return;
    }
    // Simple cycle if no modal specified: en -> ta -> hi -> en
    const langs: Array<"en" | "ta" | "hi"> = ["en", "ta", "hi"];
    const currentIdx = langs.indexOf(language as "en" | "ta" | "hi");
    const nextLang = langs[(currentIdx + 1) % langs.length];
    setLanguage(nextLang);
  };

  const getLangBadge = () => {
    switch (language) {
      case "ta":
        return "தமிழ்";
      case "hi":
        return "हिन्दी";
      default:
        return "English";
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b-2 border-slate-300 dark:bg-slate-900/95 dark:border-slate-700 shadow-sm">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* Left: Back button or Home */}
        <div className="flex items-center gap-2">
          {shouldShowBack ? (
            <button
              type="button"
              onClick={handleBack}
              className="min-h-[48px] min-w-[48px] px-3 py-2 rounded-xl border-2 border-slate-600 bg-slate-100 text-slate-900 font-bold hover:bg-slate-200 active:bg-slate-300 dark:bg-slate-800 dark:border-slate-400 dark:text-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
              aria-label="Go back to previous page"
            >
              <ArrowLeft className="w-6 h-6" aria-hidden="true" />
              <span className="text-base sm:text-lg font-bold">Back</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/citizen")}
              className="min-h-[48px] px-3 py-2 rounded-xl border-2 border-transparent hover:border-slate-300 flex items-center gap-2"
              aria-label="Citizen Home"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-800 text-white font-extrabold flex items-center justify-center text-xl dark:bg-blue-700">
                P
              </div>
              <div className="text-left">
                <span className="block text-xl font-extrabold text-slate-900 dark:text-slate-100 leading-tight">
                  {title}
                </span>
                {subtitle && (
                  <span className="block text-xs text-slate-600 dark:text-slate-400">
                    {subtitle}
                  </span>
                )}
              </div>
            </button>
          )}
        </div>

        {/* Right: Text Size Control (A+/A-) + Language Picker + Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* A+ / A- text size control */}
          <TextSizeControl size="compact" />

          {/* Language selector button */}
          <button
            type="button"
            onClick={cycleLanguage}
            className="min-h-[48px] px-3 py-2 rounded-xl border-2 border-blue-900 bg-blue-50 text-blue-950 hover:bg-blue-100 font-bold flex items-center gap-2 dark:bg-blue-950/60 dark:border-blue-400 dark:text-blue-100 dark:hover:bg-blue-900/60 transition-colors"
            aria-label={`Change language. Current language is ${getLangBadge()}`}
            title="Change language (தமிழ், हिन्दी, English)"
          >
            <Languages className="w-5 h-5 text-blue-800 dark:text-blue-300" aria-hidden="true" />
            <span className="text-base sm:text-lg font-extrabold">{getLangBadge()}</span>
          </button>

          {/* User Profile or Logout */}
          {user && (
            <button
              type="button"
              onClick={() => navigate("/citizen/profile")}
              className="min-h-[48px] min-w-[48px] p-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 flex items-center justify-center"
              aria-label="User profile"
              title={user.name || "User profile"}
            >
              <User className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
