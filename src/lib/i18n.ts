import i18n from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enTranslations from "../locales/en.json";
import taTranslations from "../locales/ta.json";
import hiTranslations from "../locales/hi.json";

// Dynamic resources registry - extensible for Telugu, Kannada, Malayalam, Bengali, Marathi
export const SUPPORTED_LANGUAGES = [
  { code: "ta", label: "தமிழ்", name: "Tamil", script: "தமிழ்" },
  { code: "hi", label: "हिन्दी", name: "Hindi", script: "हिन्दी" },
  { code: "en", label: "English", name: "English", script: "English" },
] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

const resources = {
  en: { translation: enTranslations },
  ta: { translation: taTranslations },
  hi: { translation: hiTranslations },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "ta", // Tamil first!
    lng: localStorage.getItem("petitionai_lang_chosen") || undefined,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "petitionai_lang_chosen",
      caches: ["localStorage"],
    },
  });

export function useLanguage() {
  const { i18n: i18nInstance, t } = useTranslation();
  const currentCode = (i18nInstance.language?.slice(0, 2) as SupportedLanguageCode) || "ta";

  const setLanguage = (lang: string) => {
    localStorage.setItem("petitionai_lang_chosen", lang);
    return i18nInstance.changeLanguage(lang);
  };

  return {
    language: currentCode,
    setLanguage,
    t,
    i18n: i18nInstance,
    supportedLanguages: SUPPORTED_LANGUAGES,
  };
}

export default i18n;
