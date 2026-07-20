import React from "react";

const UserCoverImage = () => (
  <div className="user-profile-img profile-settings-cover">
    <div className="profile-settings-cover-art" aria-hidden="true">
      <i className="bx bx-user-circle"></i>
    </div>
    <div className="overlay-content">
      <div className="user-chat-nav p-3">
        <h5 className="text-white mb-0">Profile settings</h5>
        <p className="text-white-50 mb-0 font-size-12">Your ellO identity</p>
      </div>
    </div>
  </div>
);

export default UserCoverImage;
