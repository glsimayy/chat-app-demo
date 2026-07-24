import React, { useState } from "react";
import {
  Button,
  Dropdown,
  DropdownMenu,
  DropdownToggle,
  DropdownItem,
} from "reactstrap";
import classnames from "classnames";

// constants
import { STATUS_TYPES } from "../../../constants";
import { usePresence } from "../../../features/presence/PresenceProvider";
interface ProfileUserProps {
  onCloseUserDetails: () => any;
  chatUserDetails: any;
  onOpenVideo: () => void;
  onOpenAudio: () => void;
  isChannel: boolean;
}
const ProfileUser = ({
  onCloseUserDetails,
  chatUserDetails,
  onOpenAudio,
  onOpenVideo,
  isChannel,
}: ProfileUserProps) => {
  const { isOnline } = usePresence();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const toggle = () => setDropdownOpen(!dropdownOpen);

  const fullName =
    chatUserDetails.name === undefined
      ? chatUserDetails.firstName
        ? `${chatUserDetails.firstName} ${chatUserDetails.lastName}`
        : "-"
      : chatUserDetails.name;
  const initials = String(fullName || "U")
    .slice(0, 2)
    .toUpperCase();
  const online = !isChannel && isOnline(chatUserDetails.participantId);
  const displayedStatus = online ? STATUS_TYPES.ACTIVE : STATUS_TYPES.OFFLINE;

  return (
    <div className="p-3 border-bottom">
      <div className="user-profile-img">
        {isChannel ? (
          <div
            className={`profile-img rounded group-profile-cover ${
              chatUserDetails.isBotManaged ? "group-profile-cover-bot" : ""
            }`}
          >
            <span className="group-profile-symbol" aria-hidden="true">
              {chatUserDetails.isBotManaged ? (
                <i className="bx bx-bot"></i>
              ) : (
                "#"
              )}
            </span>
          </div>
        ) : chatUserDetails.profileImage ? (
          <img
            src={chatUserDetails.profileImage}
            className="profile-img rounded"
            alt={`${fullName} profile`}
          />
        ) : (
          <div
            className={`profile-img rounded direct-profile-cover ${
              chatUserDetails.isBot ? "direct-profile-cover-bot" : ""
            }`}
          >
            <span className="direct-profile-symbol" aria-hidden="true">
              {chatUserDetails.isBot ? <i className="bx bx-bot"></i> : initials}
            </span>
          </div>
        )}
        <div className="overlay-content rounded">
          <div className="user-chat-nav p-2">
            <div className="d-flex w-100">
              <div className="flex-grow-1">
                <Button
                  color="none"
                  type="button"
                  className="btn nav-btn text-white user-profile-show d-none d-lg-block"
                  onClick={onCloseUserDetails}
                >
                  <i className="bx bx-x"></i>
                </Button>
                <Button
                  type="button"
                  color="none"
                  className="btn nav-btn text-white user-profile-show d-block d-lg-none"
                  onClick={onCloseUserDetails}
                >
                  <i className="bx bx-left-arrow-alt"></i>
                </Button>
              </div>
              {!isChannel && (
                <div className="flex-shrink-0">
                  <Dropdown isOpen={dropdownOpen} toggle={toggle}>
                    <DropdownToggle
                      color="none"
                      className="btn nav-btn text-white"
                      type="button"
                    >
                      <i className="bx bx-dots-vertical-rounded"></i>
                    </DropdownToggle>
                    <DropdownMenu className="dropdown-menu-end">
                      <DropdownItem
                        className="d-flex justify-content-between align-items-center d-lg-none user-profile-show"
                        to="#"
                      >
                        View Profile <i className="bx bx-user text-muted"></i>
                      </DropdownItem>
                      <DropdownItem
                        className="d-flex justify-content-between align-items-center d-lg-none"
                        to="#"
                        onClick={onOpenAudio}
                      >
                        Audio <i className="bx bxs-phone-call text-muted"></i>
                      </DropdownItem>
                      <DropdownItem
                        className="d-flex justify-content-between align-items-center d-lg-none"
                        to="#"
                        onClick={onOpenVideo}
                      >
                        Video <i className="bx bx-video text-muted"></i>
                      </DropdownItem>
                      <DropdownItem
                        className="d-flex justify-content-between align-items-center"
                        to="#"
                      >
                        Archive <i className="bx bx-archive text-muted"></i>
                      </DropdownItem>
                      <DropdownItem
                        className="d-flex justify-content-between align-items-center"
                        to="#"
                      >
                        Muted{" "}
                        <i className="bx bx-microphone-off text-muted"></i>
                      </DropdownItem>
                      <DropdownItem
                        className="d-flex justify-content-between align-items-center"
                        to="#"
                      >
                        Delete <i className="bx bx-trash text-muted"></i>
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </div>
              )}
            </div>
          </div>
          <div className="mt-auto p-3">
            <h5 className="user-name mb-1 text-truncate">{fullName}</h5>
            {isChannel ? (
              <p className="font-size-13 text-truncate mb-0">
                {chatUserDetails.isBotManaged
                  ? "BOT managed | No human owner"
                  : "Human-owned group"}
              </p>
            ) : (
              <p className="font-size-14 text-truncate mb-0">
                <i
                  className={classnames(
                    "bx",
                    "bxs-circle",
                    "font-size-10",
                    "me-1",
                    "ms-0",
                    {
                      "text-success":
                        displayedStatus === STATUS_TYPES.ACTIVE,
                    },
                    {
                      "text-muted": displayedStatus === STATUS_TYPES.OFFLINE,
                    },
                  )}
                ></i>{" "}
                {displayedStatus}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileUser;
