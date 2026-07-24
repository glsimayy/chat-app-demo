import React, { useState } from "react";
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
              Message
            </h5>
          </div>
        </div>
        <div className="col-sm col-4">
          <div className="mb-4">
            <Button
              color="none"
              className="btn avatar-sm p-0"
              aria-label={
                isBookmarked ? "Unpin conversation" : "Pin conversation"
              }
              aria-pressed={isBookmarked}
              onClick={onToggleBookmark}
            >
              <span className="avatar-title rounded bg-light text-body">
                <i className={`bx ${isBookmarked ? "bxs-pin" : "bx-pin"}`}></i>
              </span>
            </Button>
            <h5 className="font-size-11 text-uppercase text-muted mt-2">
              {isBookmarked ? "Pinned" : "Pin"}
            </h5>
          </div>
        </div>
        <div className="col-sm col-4">
          <div className="mb-4">
            <Button
              color="none"
              className="btn avatar-sm p-0"
              onClick={onOpenAudio}
              aria-label="Start audio call"
              title="Start audio call"
            >
              <span className="avatar-title rounded bg-light text-body">
                <i className="bx bxs-phone-call"></i>
              </span>
            </Button>
            <h5 className="font-size-11 text-uppercase text-muted mt-2">
              Audio
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
              aria-label="Video calls are not available in this release"
              title="Video calls are not available in this release"
            >
              <span className="avatar-title rounded bg-light text-body">
                <i className="bx bx-video"></i>
              </span>
            </Button>
            <h5 className="font-size-11 text-uppercase text-muted mt-2">
              Video
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
                aria-label="More conversation actions"
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
                      Un-Archive{" "}
                      <i className="bx bx-archive-out text-muted"></i>
                    </>
                  ) : (
                    <>
                      Archive <i className="bx bx-archive text-muted"></i>
                    </>
                  )}
                </DropdownItem>
                <DropdownItem
                  className=" d-flex justify-content-between align-items-center"
                  disabled
                >
                  Muted <i className="bx bx-microphone-off text-muted"></i>
                </DropdownItem>
                <DropdownItem
                  className="d-flex justify-content-between align-items-center text-danger"
                  onClick={onDelete}
                >
                  Delete <i className="bx bx-trash text-muted"></i>
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
            <h5 className="font-size-11 text-uppercase text-muted mt-2">
              More
            </h5>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttachedFiles;
