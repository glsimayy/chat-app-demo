import React from "react";
import { useTranslation } from "react-i18next";

const Day = () => {
  const { t } = useTranslation();

  return (
    <li className="chat-list">
      <div className="chat-day-title">
        <span className="title">{t("chat.today")}</span>
      </div>
    </li>
  );
};

export default Day;
