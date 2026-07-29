import React from "react";
import { useTranslation } from "react-i18next";

import { BasicDetailsTypes } from "../../../data/myProfile";

interface MyProfileProps {
  basicDetails: BasicDetailsTypes;
}

const MyProfile = ({ basicDetails }: MyProfileProps) => {
  const { t } = useTranslation();
  const fullName = basicDetails?.fullName || t("profile.user");
  const initials = fullName.slice(0, 2).toUpperCase();

  return (
    <>
      <div className="user-profile-img profile-overview-cover">
        <div className="profile-overview-cover-art" aria-hidden="true">
          <i className="bx bx-message-rounded-dots"></i>
        </div>
        <div className="overlay-content">
          <div className="user-chat-nav p-3">
            <h5 className="text-white mb-0">{t("profile.myProfile")}</h5>
            <p className="text-white-50 mb-0 font-size-12">
              {t("profile.accountDetails")}
            </p>
          </div>
        </div>
      </div>

      <div className="text-center p-3 p-lg-4 border-bottom pt-2 mt-n5 position-relative">
        <div className="mb-lg-3 mb-2 d-flex justify-content-center">
          {basicDetails?.avatar ? (
            <img
              src={basicDetails.avatar}
              className="rounded-circle avatar-lg img-thumbnail"
              alt={t("profile.profileImage", { name: fullName })}
            />
          ) : (
            <span className="avatar-lg rounded-circle img-thumbnail avatar-title bg-primary text-white font-size-24">
              {initials}
            </span>
          )}
        </div>

        <h5 className="font-size-16 mb-1 text-truncate">{fullName}</h5>
        <p className="text-muted font-size-14 text-truncate mb-0">
          {basicDetails?.title || t("profile.member")}
        </p>
      </div>
    </>
  );
};

export default MyProfile;
