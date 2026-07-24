import React, { useState } from "react";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from "reactstrap";

import UpdateDeleteBookmark from "../../../components/UpdateDeleteBookmark";
import { BookMarkTypes } from "../../../data/bookmarks";

interface BookMarkProps {
  bookmark: BookMarkTypes;
  onOpen: (bookmark: BookMarkTypes) => void;
  onUpdate: (id: string, data: { title: string | null }) => void;
  onDelete: (id: string) => void;
}

const BookMark = ({ bookmark, onOpen, onUpdate, onDelete }: BookMarkProps) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const displayTitle =
    bookmark.title || bookmark.message.content || "Attachment";
  const conversationTitle =
    bookmark.conversation.name ||
    (bookmark.conversation.type === "direct"
      ? bookmark.sender?.username || "Direct message"
      : "Conversation");
  const conversationIcon =
    bookmark.conversation.type === "direct" ? "bx-user" : "bx-hash";

  const onUpdateBookmark = (data: { bookmarkTitle: string | null }) => {
    onUpdate(bookmark.messageId, { title: data.bookmarkTitle });
    setIsEditOpen(false);
  };

  return (
    <>
      <li className="bookmark-message-item">
        <div className="d-flex align-items-center">
          <button
            type="button"
            className="bookmark-open-button d-flex align-items-center flex-grow-1"
            onClick={() => onOpen(bookmark)}
            aria-label={`Go to saved message: ${displayTitle}`}
          >
            <span className="flex-shrink-0 avatar-xs ms-1 me-3">
              <span className="avatar-title bg-primary-subtle text-primary rounded-circle">
                <i className={`bx ${conversationIcon}`} aria-hidden="true"></i>
              </span>
            </span>
            <span className="flex-grow-1 overflow-hidden">
              <strong className="bookmark-message-copy">{displayTitle}</strong>
              <span className="bookmark-message-meta">
                <span>{conversationTitle}</span>
                <time dateTime={bookmark.message.createdAt}>
                  {new Date(bookmark.message.createdAt).toLocaleString()}
                </time>
              </span>
            </span>
          </button>

          <div className="flex-shrink-0 ms-2">
            <Dropdown
              isOpen={dropdownOpen}
              toggle={() => setDropdownOpen(current => !current)}
            >
              <DropdownToggle
                color="none"
                className="font-size-16 text-muted px-1"
                aria-label="Saved message actions"
              >
                <i
                  className="bx bx-dots-horizontal-rounded"
                  aria-hidden="true"
                ></i>
              </DropdownToggle>
              <DropdownMenu className="dropdown-menu-end">
                <DropdownItem
                  onClick={() => onOpen(bookmark)}
                  className="d-flex align-items-center justify-content-between"
                >
                  Go to message{" "}
                  <i className="bx bx-navigation ms-2 text-muted"></i>
                </DropdownItem>
                <DropdownItem
                  onClick={() => setIsEditOpen(true)}
                  className="d-flex align-items-center justify-content-between"
                >
                  Edit <i className="bx bx-pencil ms-2 text-muted"></i>
                </DropdownItem>
                <DropdownItem divider />
                <DropdownItem
                  onClick={() => onDelete(bookmark.messageId)}
                  className="d-flex align-items-center justify-content-between"
                >
                  Delete <i className="bx bx-trash ms-2 text-muted"></i>
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>
      </li>
      {isEditOpen && (
        <UpdateDeleteBookmark
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          onUpdate={onUpdateBookmark}
          bookmark={bookmark}
        />
      )}
    </>
  );
};

export default BookMark;
