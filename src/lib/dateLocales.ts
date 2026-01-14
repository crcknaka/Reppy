import { ru, enUS, es, ptBR, de, fr, Locale } from "date-fns/locale";

export const DATE_LOCALES: Record<string, Locale> = {
  en: enUS,
  es: es,
  "pt-BR": ptBR,
  de: de,
  fr: fr,
  ru: ru,
};

export function getDateLocale(language: string): Locale {
  return DATE_LOCALES[language] || enUS;
}
