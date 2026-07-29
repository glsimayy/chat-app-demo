import React from "react";
import { useTranslation } from "react-i18next";

import { BasicDetailsTypes } from "../../../data/myProfile";

interface UserDescriptionProps {
  basicDetails: BasicDetailsTypes;
}

const ProfileField = ({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value?: string;
}) => {
  const { t } = useTranslation();

  return (
    <div className="d-flex py-2 profile-overview-field">
      <div className="flex-shrink-0 me-3">
        <i className={`${icon} align-middle text-muted`} aria-hidden="true"></i>
      </div>
      <div className="flex-grow-1 min-w-0">
        <small className="text-muted d-block">{label}</small>
        <p className="mb-0 text-break">{value || t("profile.notSpecified")}</p>
      </div>
    </div>
  );
};

const UserDescription = ({ basicDetails }: UserDescriptionProps) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="profile-overview-about mb-3">
        <small className="text-muted d-block mb-1">{t("profile.about")}</small>
        <p className="mb-0">
          {basicDetails?.description || t("profile.noNote")}
        </p>
      </div>
      <ProfileField
        icon="bx bx-user"
        label={t("profile.username")}
        value={basicDetails?.fullName}
      />
      <ProfileField
        icon="bx bx-envelope"
        label={t("profile.email")}
        value={basicDetails?.email}
      />
      <ProfileField
        icon="bx bx-map"
        label={t("profile.location")}
        value={basicDetails?.location}
      />
    </>
  );
};

export default UserDescription;
