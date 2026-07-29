import React from "react";
import { useTranslation } from "react-i18next";
import { normalizeLanguage, SupportedLanguage } from "../../../i18n";

const LanguageSettings = () => {
  const { t, i18n } = useTranslation();
  const selectedLanguage = normalizeLanguage(i18n.resolvedLanguage);
  const changeLanguage = (language: SupportedLanguage) => {
    void i18n.changeLanguage(language);
  };

  return (
    <div className="accordion-body">
      <p className="text-muted font-size-13">
        {t("settings.languageDescription")}
      </p>
      <div
        className="btn-group w-100"
        role="radiogroup"
        aria-label={t("settings.language")}
      >
        <input
          className="btn-check"
          type="radio"
          name="interface-language"
          id="settings-language-en"
          checked={selectedLanguage === "en"}
          onChange={() => changeLanguage("en")}
        />
        <label
          className="btn btn-outline-primary"
          htmlFor="settings-language-en"
        >
          EN
          <span className="ms-2">{t("settings.english")}</span>
        </label>

        <input
          className="btn-check"
          type="radio"
          name="interface-language"
          id="settings-language-tr"
          checked={selectedLanguage === "tr"}
          onChange={() => changeLanguage("tr")}
        />
        <label
          className="btn btn-outline-primary"
          htmlFor="settings-language-tr"
        >
          TR
          <span className="ms-2">{t("settings.turkish")}</span>
        </label>
      </div>
      <small className="d-block text-muted mt-2">
        {t("settings.persistedLocally")}
      </small>
    </div>
  );
};

export default LanguageSettings;
