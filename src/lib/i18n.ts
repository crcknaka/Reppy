import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from '@/locales/en.json';
import es from '@/locales/es.json';
import ptBR from '@/locales/pt-BR.json';
import de from '@/locales/de.json';
import fr from '@/locales/fr.json';
import ru from '@/locales/ru.json';

export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish', native: 'Español', flag: '🇪🇸' },
  { code: 'pt-BR', name: 'Portuguese', native: 'Português', flag: '🇧🇷' },
  { code: 'de', name: 'German', native: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'French', native: 'Français', flag: '🇫🇷' },
  { code: 'ru', name: 'Russian', native: 'Русский', flag: '🇷🇺' },
] as const;

export type LanguageCode = typeof LANGUAGES[number]['code'];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      'pt-BR': { translation: ptBR },
      de: { translation: de },
      fr: { translation: fr },
      ru: { translation: ru },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'es', 'pt-BR', 'de', 'fr', 'ru'],
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'fittrack-language',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
    // Use v4 plural rules (supports one/few/many for Russian, Polish, etc.)
    compatibilityJSON: 'v4',
  });

export type ExerciseTranslations = {
  en?: string;
  es?: string;
  "pt-BR"?: string;
  de?: string;
  fr?: string;
  ru?: string;
};

/**
 * Get translated exercise name using database translations.
 * Custom exercises keep their original name.
 *
 * @param exerciseName - The original exercise name (from database)
 * @param nameTranslations - JSONB translations object from database
 * @returns Translated name for current language, or original name as fallback
 */
export function getExerciseName(
  exerciseName: string,
  nameTranslations?: ExerciseTranslations | null
): string {
  // If no translations available, return original name
  if (!nameTranslations) {
    return exerciseName;
  }

  const currentLang = i18n.language as keyof ExerciseTranslations;

  // Try to get translation for current language
  const translated = nameTranslations[currentLang];
  if (translated) {
    return translated;
  }

  // For Russian, return original name (exercises are stored in Russian)
  if (currentLang === 'ru') {
    return exerciseName;
  }

  // Fallback to English if available
  if (nameTranslations.en) {
    return nameTranslations.en;
  }

  // Final fallback to original name
  return exerciseName;
}

export default i18n;
