import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import esCommon from './locales/es/common.json';
import esAuth from './locales/es/auth.json';
import esAdmin from './locales/es/admin.json';
import esExecution from './locales/es/execution.json';
import esMethodology from './locales/es/methodology.json';
import esOrganization from './locales/es/organization.json';
import esErrors from './locales/es/errors.json';

import ptCommon from './locales/pt/common.json';
import ptAuth from './locales/pt/auth.json';
import ptAdmin from './locales/pt/admin.json';
import ptExecution from './locales/pt/execution.json';
import ptMethodology from './locales/pt/methodology.json';
import ptOrganization from './locales/pt/organization.json';
import ptErrors from './locales/pt/errors.json';

export const SUPPORTED_LANGUAGES = ['es', 'pt'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  es: 'Español',
  pt: 'Português',
};

/** Locales que necesitan traducción en los formularios de admin (todos excepto el idioma base). */
export const TRANSLATABLE_LOCALES: string[] = SUPPORTED_LANGUAGES.filter(l => l !== 'es');

/** Emoji de bandera por locale — añadir entrada al agregar un idioma nuevo. */
export const LOCALE_FLAGS: Record<string, string> = {
  pt: '🇧🇷',
  en: '🇺🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
};

export const NAMESPACES = [
  'common',
  'auth',
  'admin',
  'execution',
  'methodology',
  'organization',
  'errors',
] as const;

const resources = {
  es: {
    common: esCommon,
    auth: esAuth,
    admin: esAdmin,
    execution: esExecution,
    methodology: esMethodology,
    organization: esOrganization,
    errors: esErrors,
  },
  pt: {
    common: ptCommon,
    auth: ptAuth,
    admin: ptAdmin,
    execution: ptExecution,
    methodology: ptMethodology,
    organization: ptOrganization,
    errors: ptErrors,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'es',
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    ns: NAMESPACES as unknown as string[],
    defaultNS: 'common',
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  });

export default i18n;
