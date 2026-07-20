import React from "react";

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
}) => (
  <div className="d-flex py-2 profile-overview-field">
    <div className="flex-shrink-0 me-3">
      <i className={`${icon} align-middle text-muted`} aria-hidden="true"></i>
    </div>
    <div className="flex-grow-1 min-w-0">
      <small className="text-muted d-block">{label}</small>
      <p className="mb-0 text-break">{value || "Not specified"}</p>
    </div>
  </div>
);

const UserDescription = ({ basicDetails }: UserDescriptionProps) => (
  <>
    <div className="profile-overview-about mb-3">
      <small className="text-muted d-block mb-1">About</small>
      <p className="mb-0">
        {basicDetails?.description || "No profile note yet."}
      </p>
    </div>
    <ProfileField
      icon="bx bx-user"
      label="Username"
      value={basicDetails?.fullName}
    />
    <ProfileField
      icon="bx bx-envelope"
      label="Email"
      value={basicDetails?.email}
    />
    <ProfileField
      icon="bx bx-map"
      label="Location"
      value={basicDetails?.location}
    />
  </>
);

export default UserDescription;
