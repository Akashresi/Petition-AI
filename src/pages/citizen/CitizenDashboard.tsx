import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FilePlus,
  Search,
  Languages,
  Clock,
  ArrowRight,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useComplaints } from "@/hooks/useComplaints";
import { useLanguage } from "@/lib/i18n";
import CitizenHeader from "@/components/ui/accessible/CitizenHeader";
import StatusBadge from "@/components/ui/accessible/StatusBadge";
import FirstLaunchLanguageModal from "@/components/features/FirstLaunchLanguageModal";

export default function CitizenDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { complaints, getByUser } = useComplaints();
  const { t, language } = useLanguage();
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const myComplaints = getByUser(user?.id || "u1");
  const recentComplaints = myComplaints.slice(0, 4);

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/citizen/track?query=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate("/citizen/track");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Accessible Header with A+/A- scaler and Language Selector */}
      <CitizenHeader
        title={t("citizen.title", "Citizen Portal")}
        subtitle={user?.name ? `${t("citizen.welcome", "Welcome")}, ${user.name}` : undefined}
        showBack={false}
        onOpenLanguage={() => setLangModalOpen(true)}
      />

      {/* First-launch modal if language not yet picked */}
      <FirstLaunchLanguageModal
        forceOpen={langModalOpen}
        onClose={() => setLangModalOpen(false)}
      />

      <main className="max-w-2xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Welcome greeting in plain language */}
        <div className="text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
            {t("citizen.welcome", "Welcome")}, {user?.name || "Citizen"}
          </h1>
          <p className="text-lg sm:text-xl text-slate-700 dark:text-slate-300 mt-1">
            {t("citizen.homeSubtitle", "A simple way to report problems and track solutions")}
          </p>
        </div>

        {/* ── 3 Big Action Buttons (Core Tasks) ── */}
        <div className="space-y-4" role="region" aria-label="Main Actions">
          {/* 1. Report a problem (Single primary button per screen rule) */}
          <Link
            to="/citizen/submit"
            className="w-full min-h-[72px] sm:min-h-[84px] px-6 py-5 rounded-2xl border-3 border-blue-900 bg-blue-800 text-white hover:bg-blue-900 active:bg-blue-950 flex items-center justify-between transition-colors shadow-md dark:bg-blue-700 dark:border-blue-500"
            aria-label={t("citizen.reportProblem", "Report a problem")}
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-blue-900/60 flex items-center justify-center shrink-0 border border-blue-400">
                <FilePlus className="w-8 h-8 text-amber-300" aria-hidden="true" />
              </div>
              <div className="text-left">
                <span className="block text-xl sm:text-2xl font-extrabold leading-tight">
                  {t("citizen.reportProblem", "Report a problem")}
                </span>
                <span className="block text-sm sm:text-base text-blue-100">
                  {t("citizen.reportProblemDesc", "Speak or type your problem in 4 simple steps")}
                </span>
              </div>
            </div>
            <ArrowRight className="w-7 h-7 shrink-0 text-white" aria-hidden="true" />
          </Link>

          {/* 2. Track my complaint */}
          <div className="bg-white border-2 border-slate-400 rounded-2xl p-4 sm:p-5 shadow-sm dark:bg-slate-900 dark:border-slate-700">
            <Link
              to="/citizen/track"
              className="flex items-center justify-between text-left group"
              aria-label={t("citizen.trackComplaint", "Track my complaint")}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-300 dark:bg-slate-800 dark:border-slate-600">
                  <Search className="w-6 h-6 text-slate-800 dark:text-slate-200" aria-hidden="true" />
                </div>
                <div>
                  <span className="block text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-800 dark:group-hover:text-blue-400">
                    {t("citizen.trackComplaint", "Track my complaint")}
                  </span>
                  <span className="block text-sm sm:text-base text-slate-600 dark:text-slate-400">
                    {t("citizen.trackComplaintDesc", "Check progress using complaint number or phone")}
                  </span>
                </div>
              </div>
              <ArrowRight className="w-6 h-6 text-slate-500 group-hover:translate-x-1 transition-transform" />
            </Link>

            {/* Quick search input */}
            <form onSubmit={handleTrackSubmit} className="mt-4 flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("citizen.trackInputPlaceholder", "Enter PET-2024-XXX or phone number")}
                className="flex-1 min-h-[48px] px-3 py-2 text-base sm:text-lg border-2 border-slate-400 rounded-xl bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
                aria-label="Complaint ID or Phone"
              />
              <button
                type="submit"
                className="min-h-[48px] px-4 py-2 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 border-2 border-slate-900 dark:bg-slate-700 dark:border-slate-600 transition-colors flex items-center gap-2"
              >
                <Search className="w-5 h-5" />
                <span>{t("common.search", "Search")}</span>
              </button>
            </form>
          </div>

          {/* 3. Change language */}
          <button
            type="button"
            onClick={() => setLangModalOpen(true)}
            className="w-full min-h-[64px] px-6 py-4 rounded-2xl border-2 border-slate-400 bg-white text-slate-900 hover:bg-slate-100 active:bg-slate-200 flex items-center justify-between transition-colors shadow-sm dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
            aria-label={t("citizen.changeLanguage", "Change language")}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 border border-amber-300 dark:bg-amber-950/40 dark:border-amber-700">
                <Languages className="w-6 h-6 text-amber-800 dark:text-amber-300" aria-hidden="true" />
              </div>
              <div className="text-left">
                <span className="block text-lg sm:text-xl font-bold">
                  {t("citizen.changeLanguage", "Change language")}
                </span>
                <span className="block text-sm sm:text-base text-slate-600 dark:text-slate-400">
                  தமிழ் • हिन्दी • English
                </span>
              </div>
            </div>
            <span className="text-base font-extrabold text-blue-900 bg-blue-100 px-3 py-1 rounded-lg border border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700">
              {language === "ta" ? "தமிழ்" : language === "hi" ? "हिन्दी" : "English"}
            </span>
          </button>
        </div>

        {/* ── Recent Complaints ── */}
        <section className="pt-2" aria-labelledby="recent-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="recent-heading" className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              {t("citizen.recentComplaints", "My Recent Complaints")}
            </h2>
            {myComplaints.length > 0 && (
              <Link
                to="/citizen/petitions"
                className="text-base sm:text-lg font-bold text-blue-800 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <span>View All ({myComplaints.length})</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {recentComplaints.length === 0 ? (
            <div className="bg-white border-2 border-slate-300 rounded-2xl p-6 text-center dark:bg-slate-900 dark:border-slate-700">
              <CheckCircle2 className="w-12 h-12 text-slate-400 mx-auto mb-2" />
              <p className="text-lg text-slate-700 dark:text-slate-300">
                {t("citizen.noComplaints", "No complaints filed yet. Tap 'Report a problem' above.")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentComplaints.map((c) => (
                <div
                  key={c.id}
                  onClick={() => navigate(`/citizen/petitions/${c.id}`)}
                  className="bg-white border-2 border-slate-300 hover:border-blue-600 rounded-xl p-4 transition-colors cursor-pointer shadow-sm dark:bg-slate-900 dark:border-slate-700"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/citizen/petitions/${c.id}`)}
                  aria-label={`View complaint ${c.petitionId}: ${c.title}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="font-mono text-base font-extrabold text-blue-900 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                      {c.petitionId}
                    </span>
                    <StatusBadge status={c.status} />
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                    {c.title}
                  </h3>

                  <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400 mt-2">
                    {c.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4 text-slate-500" />
                        <span className="truncate max-w-[200px]">{c.location}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1 ml-auto">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <span>{new Date(c.submittedAt).toLocaleDateString()}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
