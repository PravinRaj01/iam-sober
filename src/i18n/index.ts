import { en, type TranslationKey } from "./en";
import { ms } from "./ms";
import { ta } from "./ta";

export type Language = "en" | "ms" | "ta";

export const translations: Record<Language, Record<TranslationKey, string>> = {
  en,
  ms,
  ta,
};

export const languageNames: Record<Language, string> = {
  en: "English",
  ms: "Bahasa Melayu",
  ta: "தமிழ்",
};

export type { TranslationKey };
