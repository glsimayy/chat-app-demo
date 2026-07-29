import React from "react";
import { useTranslation } from "react-i18next";

interface BasicDetailsProps {
  chatUserDetails: any;
}
const BasicDetails = ({ chatUserDetails }: BasicDetailsProps) => {
  const { t } = useTranslation();
  const fullName = chatUserDetails.firstName
    ? `${chatUserDetails.firstName} ${chatUserDetails.lastName}`
    : "-";

  return (
    <div className="pb-2">
      <h5 className="font-size-11 text-uppercase mb-2">{t("profile.info")}:</h5>
      <div>
        <div className="d-flex align-items-end">
          <div className="flex-grow-1">
            <p className="text-muted font-size-14 mb-1">{t("profile.name")}</p>
          </div>
          <div className="flex-shrink-0">
            <button type="button" className="btn btn-sm btn-soft-primary">
              {t("profile.edit")}
            </button>
          </div>
        </div>
        <h5 className="font-size-14">{fullName}</h5>
      </div>

      <div className="mt-4">
        <p className="text-muted font-size-14 mb-1">{t("profile.email")}</p>
        <h5 className="font-size-14">
          {chatUserDetails.email ? chatUserDetails.email : "-"}
        </h5>
      </div>

      <div className="mt-4">
        <p className="text-muted font-size-14 mb-1">{t("profile.location")}</p>
        <h5 className="font-size-14 mb-0">
          {chatUserDetails.location ? chatUserDetails.location : "-"}
        </h5>
      </div>
    </div>
  );
};

export default BasicDetails;
