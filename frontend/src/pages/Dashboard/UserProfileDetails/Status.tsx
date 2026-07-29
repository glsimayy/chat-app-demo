import React from "react";
import { useTranslation } from "react-i18next";

interface StatusProps {
  about: string;
}
const Status = ({ about }: StatusProps) => {
  const { t } = useTranslation();

  return (
    <div className="text-muted pt-4">
      <h5 className="font-size-11 text-uppercase">{t("profile.status")}:</h5>
      <p className="mb-4">{about ? about : "-"}</p>
    </div>
  );
};

export default Status;
