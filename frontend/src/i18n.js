import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

i18n
  // load translations using http (default public/locales/{{lng}}/{{ns}}.json)
  // For production, you might store these in a 'public/locales' folder
  .use(Backend)
  // detect user language
  .use(LanguageDetector)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // init i18next
  .init({
    // For development, load translations from 'public/locales'
    // If you prefer to bundle them directly, you can use the 'resources' object as shown in previous examples.
    // However, using Backend is common for larger apps or if translations are updated frequently.
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json', // This path refers to files in your public folder
    },
    
    fallbackLng: 'en', // Fallback language if detected language is not available
    debug: false, // Set to true in development for console logs

    interpolation: {
      escapeValue: false, // React already prevents XSS
    },
    // Options for language detection (order matters)
    detection: {
      order: ['queryString', 'cookie', 'localStorage', 'sessionStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage', 'cookie'], // Cache detected language
    }
  });

export default i18n;