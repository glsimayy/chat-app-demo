import React, { ChangeEvent, useState } from "react";
import { Label, Spinner } from "reactstrap";

import { BasicDetailsTypes } from "../../../data/settings";
import { useTranslation } from "react-i18next";

interface UserProfileProps {
  basicDetails: BasicDetailsTypes;
  onProfileImageChange: (file: File) => Promise<void>;
}

const UserProfile = ({
  basicDetails,
  onProfileImageChange,
}: UserProfileProps) => {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const initials = (basicDetails.username || "U").slice(0, 2).toUpperCase();

  const onChangeProfile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      await onProfileImageChange(file);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="text-center p-3 p-lg-4 border-bottom pt-2 mt-n5 position-relative">
      <div className="mb-3 profile-user profile-editor-avatar">
        {basicDetails.profile ? (
          <img
            src={basicDetails.profile}
            className="rounded-circle avatar-lg img-thumbnail user-profile-image"
            alt={`${basicDetails.username} profile`}
          />
        ) : (
          <span className="avatar-lg rounded-circle img-thumbnail avatar-title bg-primary text-white font-size-24">
            {initials}
          </span>
        )}
        <div className="avatar-xs p-0 rounded-circle profile-photo-edit">
          <input
            onChange={onChangeProfile}
            id="profile-img-file-input"
            type="file"
            className="profile-img-file-input"
            accept="image/png,image/jpeg,image/webp"
            disabled={uploading}
          />
          <Label
            htmlFor="profile-img-file-input"
            className="profile-photo-edit avatar-xs"
            title={t("settings.changeProfileImage")}
          >
            <span className="avatar-title rounded-circle bg-light text-body">
              {uploading ? (
                <Spinner size="sm" />
              ) : (
                <i className="bx bxs-camera" aria-hidden="true"></i>
              )}
            </span>
          </Label>
        </div>
      </div>

      <h5 className="font-size-16 mb-1 text-truncate">
        {basicDetails.username}
      </h5>
      <p className="text-muted mb-0 font-size-13">
        {basicDetails.email} <span aria-hidden="true">|</span>{" "}
        <span className="text-capitalize">{basicDetails.role}</span>
      </p>
    </div>
  );
};

export default UserProfile;
