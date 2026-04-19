import i18n, { type InitOptions } from "i18next";
import { initReactI18next } from "react-i18next";
import enTranslation from "./locales/en.json";
import koTranslation from "./locales/ko.json";

const resources = {
    en: {
        translation: enTranslation,
    },
    ko: {
        translation: koTranslation,
    },
};

i18n.use(initReactI18next).init({
    debug: false,
    fallbackLng: "en",
    interpolation: {
        escapeValue: false,
    },
    resources,
    defaultNS: "translation",
    react: {
        useSuspense: true,
    },
} as InitOptions);

export default i18n;
