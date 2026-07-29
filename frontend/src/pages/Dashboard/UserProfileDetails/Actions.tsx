import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Dropdown,
  DropdownMenu,
  DropdownToggle,
  DropdownItem,
} from "reactstrap";
interface AttachedFilesProps {
  onOpenVideo: () => void;
  onOpenAudio: () => void;
  onToggleBookmark: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
  isBookmarked: boolean;
  isArchived: boolean;
}
const AttachedFiles = ({
  onOpenVideo,
  onOpenAudio,
  onToggleBookmark,
  onToggleArchive,
  onDelete,
  isBookmarked,
  isArchived,
}: AttachedFilesProps) => {
  const { t } = useTranslation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const toggle = () => setDropdownOpen(!dropdownOpen);
  return (
    <div className="text-center border-bottom">
      <div className="row">
        <div className="col-sm col-4">
          <div className="mb-4">
            <Button color="none" type="button" className="btn avatar-sm p-0">
              <span className="avatar-title rounded bg-light text-body">
                <i className="bx bxs-message-alt-detail"></i>
              </span>
            </Button>
            <h5 className="font-size-11 text-uppercase text-muted mt-2">
              {t("support.message")}
            </h5>
          </div>
        </div>
        <div className="col-sm col-4">
          <div className="mb-4">
            <Button
              color="none"
              className="btn avatar-sm p-0"
              aria-label={
                isBookmarked
                  ? t("profile.unpinConversation")
                  : t("profile.pinConversation")
              }
              aria-pressed={isBookmarked}
              onClick={onToggleBookmark}
            >
              <span className="avatar-title rounded bg-light text-body">
                <i className={`bx ${isBookmarked ? "bxs-pin" : "bx-pin"}`}></i>
              </span>
            </Button>
            <h5 className="font-size-11 text-uppercase text-muted mt-2">
              {t(isBookmarked ? "profile.pinned" : "profile.pin")}
            </h5>
          </div>
        </div>
        <div className="col-sm col-4">
          <div className="mb-4">
            <Button
              color="none"
              className="btn avatar-sm p-0"
              onClick={onOpenAudio}
              aria-label={t("profile.startAudioCall")}
              title={t("profile.startAudioCall")}
            >
              <span className="avatar-title rounded bg-light text-body">
                <i className="bx bxs-phone-call"></i>
              </span>
            </Button>
            <h5 className="font-size-11 text-uppercase text-muted mt-2">
              {t("profile.audio")}
            </h5>
          </div>
        </div>
        <div className="col-sm col-4">
          <div className="mb-4">
            <Button
              color="none"
              type="button"
              className="btn avatar-sm p-0"
              onClick={onOpenVideo}
              aria-label={t("profile.videoUnavailable")}
              title={t("profile.videoUnavailable")}
            >
              <span className="avatar-title rounded bg-light text-body">
                <i className="bx bx-video"></i>
              </span>
            </Button>
            <h5 className="font-size-11 text-uppercase text-muted mt-2">
              {t("profile.video")}
            </h5>
          </div>
        </div>
        <div className="col-sm col-4">
          <div className="mb-4">
            <Dropdown isOpen={dropdownOpen} toggle={toggle}>
              <DropdownToggle
                color="none"
                className="btn avatar-sm p-0 dropdown-toggle"
                type="button"
                aria-label={t("profile.moreActions")}
              >
                <span className="avatar-title bg-light text-body rounded">
                  <i className="bx bx-dots-horizontal-rounded"></i>
                </span>
              </DropdownToggle>

              <DropdownMenu className="dropdown-menu-end">
                <DropdownItem
                  className=" d-flex justify-content-between align-items-center"
                  to="#"
                  onClick={onToggleArchive}
                >
                  {isArchived ? (
                    <>
                      {t("profile.unarchive")}{" "}
                      <i className="bx bx-archive-out text-muted"></i>
                    </>
                  ) : (
                    <>
                      {t("profile.archive")}{" "}
                      <i className="bx bx-archive text-muted"></i>
                    </>
                  )}
                </DropdownItem>
                <DropdownItem
                  className=" d-flex justify-content-between align-items-center"
                  disabled
                >
                  {t("profile.muted")}{" "}
                  <i className="bx bx-microphone-off text-muted"></i>
                </DropdownItem>
                <DropdownItem
                  className="d-flex justify-content-between align-items-center text-danger"
                  onClick={onDelete}
                >
                  {t("chat.delete")} <i className="bx bx-trash text-muted"></i>
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
            <h5 className="font-size-11 text-uppercase text-muted mt-2">
              {t("chat.more")}
            </h5>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttachedFiles;
