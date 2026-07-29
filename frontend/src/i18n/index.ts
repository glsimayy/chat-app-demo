import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en, tr } from "./resources";

export type SupportedLanguage = "en" | "tr";

export const LANGUAGE_STORAGE_KEY = "ello-language";
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ["en", "tr"];

export const normalizeLanguage = (
  language?: string | null,
): SupportedLanguage => {
  const baseLanguage = language?.trim().toLowerCase().split("-")[0];
  return baseLanguage === "tr" ? "tr" : "en";
};

export const detectInitialLanguage = (
  storedLanguage?: string | null,
  browserLanguage?: string | null,
) =>
  storedLanguage
    ? normalizeLanguage(storedLanguage)
    : normalizeLanguage(browserLanguage);

const readStoredLanguage = () => {
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
};

const initialLanguage =
  typeof window === "undefined"
    ? "en"
    : detectInitialLanguage(readStoredLanguage(), window.navigator.language);

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    tr: { translation: tr },
  },
  lng: initialLanguage,
  fallbackLng: "en",
  supportedLngs: SUPPORTED_LANGUAGES,
  load: "languageOnly",
  initImmediate: false,
  interpolation: {
    escapeValue: false,
  },
});

const persistLanguage = (language: string) => {
  const normalizedLanguage = normalizeLanguage(language);

  if (typeof document !== "undefined") {
    document.documentElement.lang = normalizedLanguage;
  }

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizedLanguage);
    } catch {
      // Language still applies for the current session when storage is blocked.
    }
  }
};

persistLanguage(initialLanguage);
i18n.on("languageChanged", persistLanguage);

export default i18n;
