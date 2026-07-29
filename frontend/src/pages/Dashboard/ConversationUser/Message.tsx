import React, { useEffect, useState } from "react";
import {
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  Dropdown,
  Button,
  Form,
  FormGroup,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
} from "reactstrap";
import classnames from "classnames";
import { Link } from "react-router-dom";

// components
import LightBox from "../../../components/LightBox";
import SharedContactCard from "../../../components/SharedContactCard";
import UserProfileModal from "../../../components/UserProfileModal";

//images
import imagePlaceholder from "../../../assets/images/users/user-dummy-img.jpg";

// interface
import {
  MessagesTypes,
  ImageTypes,
  AttachmentTypes,
} from "../../../data/messages";

// hooks
import { useProfile } from "../../../hooks";

import RepliedMessage from "./RepliedMessage";
import { getAttachmentBlob } from "../../../api/chats";
import { parseSharedContactMessage } from "../../../utils/sharedContact";
import {
  createMessageReport,
  MessageReportReason,
} from "../../../api/moderation";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../../../helpers/notifications";
import { isMessageReportable } from "../../../utils/messageReporting";
import { MentionMember, tokenizeMentions } from "../../../utils/mentions";
import { useTranslation } from "react-i18next";
import { translateKnownSystemMessage } from "../../../utils/systemMessages";

interface MentionTextProps {
  text: string;
  members: MentionMember[];
}

const MentionText = ({ text, members }: MentionTextProps) => {
  const { t } = useTranslation();

  return (
    <>
      {tokenizeMentions(text, members).map((segment, index) =>
        segment.isMention ? (
          <span
            className="message-mention"
            title={
              segment.member?.email ||
              segment.member?.username ||
              t("groupManagement.groupMember")
            }
            key={`${index}-${segment.text}`}
          >
            {segment.text}
          </span>
        ) : (
          <React.Fragment key={`${index}-${segment.text}`}>
            {segment.text}
          </React.Fragment>
        ),
      )}
    </>
  );
};

interface MenuProps {
  canModify: boolean;
  isBookmarked: boolean;
  bookmarkLoading: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReply: () => any;
  onForward: () => void;
  onCopy: () => void;
  onMarkUnread: () => void;
  markUnreadLoading: boolean;
  onToggleBookmark: () => void;
  canReport: boolean;
  onReport: () => void;
}

const Menu = ({
  canModify,
  isBookmarked,
  bookmarkLoading,
  onEdit,
  onDelete,
  onReply,
  onForward,
  onCopy,
  onMarkUnread,
  markUnreadLoading,
  onToggleBookmark,
  canReport,
  onReport,
}: MenuProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dropdown
      isOpen={isOpen}
      toggle={() => setIsOpen(current => !current)}
      className="align-self-start message-box-drop"
    >
      <DropdownToggle
        aria-label={t("chat.messageActions")}
        className="btn btn-toggle"
        tag="button"
        type="button"
      >
        <i className="ri-more-2-fill"></i>
      </DropdownToggle>
      <DropdownMenu
        className="message-actions-menu"
        container="body"
        strategy="fixed"
      >
        <DropdownItem
          className="d-flex align-items-center justify-content-between"
          to="#"
          onClick={onReply}
        >
          {t("chat.reply")} <i className="bx bx-share ms-2 text-muted"></i>
        </DropdownItem>
        <DropdownItem
          className="d-flex align-items-center justify-content-between"
          to="#"
          onClick={onForward}
        >
          {t("chat.forward")}{" "}
          <i className="bx bx-share-alt ms-2 text-muted"></i>
        </DropdownItem>
        {canModify && (
          <DropdownItem
            className="d-flex align-items-center justify-content-between"
            onClick={onEdit}
          >
            {t("chat.edit")} <i className="bx bx-edit text-muted ms-2"></i>
          </DropdownItem>
        )}
        <DropdownItem
          className="d-flex align-items-center justify-content-between"
          onClick={onCopy}
        >
          {t("chat.copy")} <i className="bx bx-copy text-muted ms-2"></i>
        </DropdownItem>
        <DropdownItem
          className="d-flex align-items-center justify-content-between"
          to="#"
          disabled={bookmarkLoading}
          onClick={onToggleBookmark}
        >
          {t(isBookmarked ? "chat.removeFromSaved" : "chat.saveMessage")}
          <i
            className={`bx ${
              isBookmarked ? "bxs-bookmark" : "bx-bookmark"
            } text-muted ms-2`}
          ></i>
        </DropdownItem>
        <DropdownItem
          className="d-flex align-items-center justify-content-between"
          disabled={markUnreadLoading}
          onClick={onMarkUnread}
        >
          {t("chat.markUnread")}{" "}
          <i className="bx bx-message-error text-muted ms-2"></i>
        </DropdownItem>
        {canReport && (
          <DropdownItem
            className="d-flex align-items-center justify-content-between text-danger"
            onClick={onReport}
          >
            {t("chat.report")} <i className="bx bx-flag text-danger ms-2"></i>
          </DropdownItem>
        )}
        {canModify && (
          <DropdownItem
            className="d-flex align-items-center justify-content-between delete-item"
            onClick={onDelete}
          >
            {t("chat.delete")} <i className="bx bx-trash text-muted ms-2"></i>
          </DropdownItem>
        )}
      </DropdownMenu>
    </Dropdown>
  );
};
interface ImageMoreMenuProps {
  imagelink: any;
  canModify: boolean;
  isBookmarked: boolean;
  bookmarkLoading: boolean;
  onReply: () => any;
  onForward: () => void;
  onDelete: () => void;
  onToggleBookmark: () => void;
  canReport: boolean;
  onReport: () => void;
}
const ImageMoreMenu = ({
  imagelink,
  canModify,
  isBookmarked,
  bookmarkLoading,
  onReply,
  onForward,
  onDelete,
  onToggleBookmark,
  canReport,
  onReport,
}: ImageMoreMenuProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="message-img-link">
      <ul className="list-inline mb-0">
        <Dropdown
          tag="li"
          isOpen={isOpen}
          toggle={() => setIsOpen(current => !current)}
          color="none"
          className="list-inline-item dropdown"
        >
          <DropdownToggle
            aria-label={t("chat.imageActions")}
            tag="button"
            type="button"
            className="btn btn-toggle"
          >
            <i className="bx bx-dots-horizontal-rounded"></i>
          </DropdownToggle>
          <DropdownMenu
            className="message-actions-menu"
            container="body"
            strategy="fixed"
          >
            <DropdownItem
              className="dropdown-item d-flex align-items-center justify-content-between"
              href={imagelink}
              download
            >
              {t("chat.download")}{" "}
              <i className="bx bx-download ms-2 text-muted"></i>
            </DropdownItem>
            <DropdownItem
              tag="a"
              className=" d-flex align-items-center justify-content-between"
              href="#"
              onClick={onReply}
            >
              {t("chat.reply")} <i className="bx bx-share ms-2 text-muted"></i>
            </DropdownItem>
            <DropdownItem
              className=" d-flex align-items-center justify-content-between"
              onClick={onForward}
            >
              {t("chat.forward")}{" "}
              <i className="bx bx-share-alt ms-2 text-muted"></i>
            </DropdownItem>
            <DropdownItem
              tag="a"
              className=" d-flex align-items-center justify-content-between"
              href="#"
              disabled={bookmarkLoading}
              onClick={onToggleBookmark}
            >
              {t(isBookmarked ? "chat.removeFromSaved" : "chat.saveMessage")}
              <i
                className={`bx ${
                  isBookmarked ? "bxs-bookmark" : "bx-bookmark"
                } text-muted ms-2`}
              ></i>
            </DropdownItem>
            {canReport && (
              <DropdownItem
                className="d-flex align-items-center justify-content-between text-danger"
                onClick={onReport}
              >
                {t("chat.reportImage")}
                <i className="bx bx-flag text-danger ms-2"></i>
              </DropdownItem>
            )}
            {canModify && (
              <DropdownItem
                tag="a"
                className=" d-flex align-items-center justify-content-between delete-item"
                href="#"
                onClick={onDelete}
              >
                {t("chat.deleteMessage")}{" "}
                <i className="bx bx-trash ms-2 text-muted"></i>
              </DropdownItem>
            )}
          </DropdownMenu>
        </Dropdown>
      </ul>
    </div>
  );
};

interface ImageProps {
  message: MessagesTypes;
  image: ImageTypes;
  canModify: boolean;
  onImageClick: (id: number) => void;
  index: number;
  onSetReplyData: (reply: null | MessagesTypes | undefined) => void;
  onForward: () => void;
  onDeleteImg: (imageId: string | number) => void;
  isBookmarked: boolean;
  bookmarkLoading: boolean;
  onToggleBookmark: () => void;
  canReport: boolean;
  onReport: () => void;
}
const Image = ({
  message,
  image,
  canModify,
  onImageClick,
  index,
  onSetReplyData,
  onForward,
  onDeleteImg,
  isBookmarked,
  bookmarkLoading,
  onToggleBookmark,
  canReport,
  onReport,
}: ImageProps) => {
  const { t } = useTranslation();
  const onDelete = () => {
    onDeleteImg(image.id);
  };
  const onClickReply = () => {
    let multiimages: any = message["image"];

    let results = multiimages.filter(
      (multiimage: any) => multiimage.id === image.id,
    );

    message["newimage"] = results;

    onSetReplyData(message);
  };
  return (
    <React.Fragment>
      <div className="message-img-list">
        <div>
          {image.downloadLink ? (
            <Link
              className="popup-img d-inline-block"
              to={"#"}
              onClick={() => onImageClick(index)}
            >
              <img
                src={image.downloadLink}
                alt={image.name || t("chat.messageAttachment")}
                className="rounded border"
              />
            </Link>
          ) : (
            <div className="message-image-loading rounded border">
              <Spinner size="sm" />
            </div>
          )}
        </div>
        {image.downloadLink && (
          <ImageMoreMenu
            imagelink={image.downloadLink}
            canModify={canModify}
            isBookmarked={isBookmarked}
            bookmarkLoading={bookmarkLoading}
            onReply={onClickReply}
            onForward={onForward}
            onDelete={onDelete}
            onToggleBookmark={onToggleBookmark}
            canReport={canReport}
            onReport={onReport}
          />
        )}
      </div>
    </React.Fragment>
  );
};
interface ImagesProps {
  message: MessagesTypes;
  images: ImageTypes[];
  canModify: boolean;
  onSetReplyData: (reply: null | MessagesTypes | undefined) => void;
  onForward: () => void;
  onDeleteImg: (imageId: string | number) => void;
  isBookmarked: boolean;
  bookmarkLoading: boolean;
  onToggleBookmark: () => void;
  canReport: boolean;
  onReport: () => void;
}
const Images = ({
  message,
  images,
  canModify,
  onSetReplyData,
  onForward,
  onDeleteImg,
  isBookmarked,
  bookmarkLoading,
  onToggleBookmark,
  canReport,
  onReport,
}: ImagesProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const [resolvedImages, setResolvedImages] = useState<ImageTypes[]>(images);

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];

    setResolvedImages(
      images.map(image =>
        image.requiresAuth ? { ...image, downloadLink: "" } : image,
      ),
    );

    Promise.all(
      images.map(async image => {
        if (!image.requiresAuth) {
          return image;
        }

        try {
          const blob = await getAttachmentBlob(image.downloadLink);
          const objectUrl = URL.createObjectURL(blob);
          objectUrls.push(objectUrl);
          return { ...image, downloadLink: objectUrl, requiresAuth: false };
        } catch {
          return { ...image, downloadLink: "" };
        }
      }),
    ).then(nextImages => {
      if (active) {
        setResolvedImages(nextImages);
      }
    });

    return () => {
      active = false;
      objectUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [images]);

  const onImageClick = (id: number) => {
    setSelected(id);
    setIsOpen(true);
  };
  const onClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      <div className="message-img mb-0">
        {(resolvedImages || []).map((image: ImageTypes, key: number) => (
          <Image
            message={message}
            image={image}
            canModify={canModify}
            key={key}
            index={key}
            onImageClick={onImageClick}
            onSetReplyData={onSetReplyData}
            onForward={onForward}
            onDeleteImg={onDeleteImg}
            isBookmarked={isBookmarked}
            bookmarkLoading={bookmarkLoading}
            onToggleBookmark={onToggleBookmark}
            canReport={canReport}
            onReport={onReport}
          />
        ))}
      </div>
      {isOpen && (
        <LightBox
          isOpen={isOpen}
          images={resolvedImages.filter(image => image.downloadLink)}
          onClose={onClose}
          defaultIdx={selected}
        />
      )}
    </>
  );
};

interface AttachmentsProps {
  attachments: AttachmentTypes[] | undefined;
}

interface AudioAttachmentPlayerProps {
  attachment: AttachmentTypes;
  downloading: boolean;
  onDownload: (attachment: AttachmentTypes) => Promise<void>;
}

const AudioAttachmentPlayer = ({
  attachment,
  downloading,
  onDownload,
}: AudioAttachmentPlayerProps) => {
  const { t } = useTranslation();
  const [source, setSource] = useState(
    attachment.requiresAuth ? "" : attachment.downloadLink,
  );
  const [loading, setLoading] = useState(Boolean(attachment.requiresAuth));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    if (!attachment.requiresAuth) {
      setSource(attachment.downloadLink);
      setLoading(false);
      setFailed(false);
      return;
    }

    setSource("");
    setLoading(true);
    setFailed(false);
    getAttachmentBlob(attachment.downloadLink)
      .then(blob => {
        objectUrl = URL.createObjectURL(blob);
        if (active) {
          setSource(objectUrl);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoading(false);
          setFailed(true);
        }
      });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [attachment.downloadLink, attachment.id, attachment.requiresAuth]);

  return (
    <div className="message-audio-attachment">
      <div className="message-audio-heading">
        <span className="message-audio-icon" aria-hidden="true">
          <i className="bx bxs-microphone"></i>
        </span>
        <div>
          <strong>{t("chat.voiceMessage")}</strong>
          <span>{attachment.name}</span>
          <span>{attachment.desc}</span>
        </div>
        <Button
          type="button"
          color="link"
          className="message-audio-download"
          title={t("chat.downloadFile", { name: attachment.name })}
          aria-label={t("chat.downloadFile", { name: attachment.name })}
          disabled={downloading}
          onClick={() => void onDownload(attachment)}
        >
          {downloading ? (
            <Spinner size="sm" />
          ) : (
            <i className="bx bxs-download"></i>
          )}
        </Button>
      </div>
      {loading ? (
        <div className="message-audio-loading" role="status">
          <Spinner size="sm" />
          <span>{t("chat.loadingVoiceMessage")}</span>
        </div>
      ) : failed || !source ? (
        <span className="text-danger font-size-12">
          {t("chat.voiceLoadFailed")}
        </span>
      ) : (
        <audio
          controls
          preload="metadata"
          src={source}
          aria-label={t("chat.playVoiceMessage", { name: attachment.name })}
        />
      )}
    </div>
  );
};

const Attachments = ({ attachments }: AttachmentsProps) => {
  const { t } = useTranslation();
  const [downloadingId, setDownloadingId] = useState<string | number | null>(
    null,
  );
  const audioAttachments = (attachments || []).filter(attachment =>
    attachment.mimeType?.startsWith("audio/"),
  );
  const fileAttachments = (attachments || []).filter(
    attachment => !attachment.mimeType?.startsWith("audio/"),
  );

  const onDownload = async (attachment: AttachmentTypes) => {
    try {
      setDownloadingId(attachment.id);
      const blob = await getAttachmentBlob(attachment.downloadLink);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = attachment.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <>
      {audioAttachments.map(attachment => (
        <AudioAttachmentPlayer
          key={attachment.id}
          attachment={attachment}
          downloading={downloadingId === attachment.id}
          onDownload={onDownload}
        />
      ))}
      {fileAttachments.map((attachment: AttachmentTypes, key: number) => (
        <div
          key={attachment.id}
          className={classnames("p-3", "border-primary", "border rounded-3", {
            "mt-2": key !== 0 || audioAttachments.length > 0,
          })}
        >
          <div className="d-flex align-items-center attached-file">
            <div className="flex-shrink-0 avatar-sm me-3 ms-0 attached-file-avatar">
              <div className="avatar-title bg-primary-subtle text-primary rounded-circle font-size-20">
                <i className="ri-attachment-2"></i>
              </div>
            </div>
            <div className="flex-grow-1 overflow-hidden">
              <div className="text-start">
                <h5 className="font-size-14 mb-1">{attachment.name}</h5>
                <p className="text-muted text-truncate font-size-13 mb-0">
                  {attachment.desc}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0 ms-4">
              <div className="d-flex gap-2 font-size-20 d-flex align-items-start">
                <div>
                  {attachment.requiresAuth ? (
                    <Button
                      type="button"
                      color="link"
                      className="text-muted p-0"
                      title={t("chat.downloadFile", {
                        name: attachment.name,
                      })}
                      aria-label={t("chat.downloadFile", {
                        name: attachment.name,
                      })}
                      disabled={downloadingId === attachment.id}
                      onClick={() => onDownload(attachment)}
                    >
                      {downloadingId === attachment.id ? (
                        <Spinner size="sm" />
                      ) : (
                        <i className="bx bxs-download"></i>
                      )}
                    </Button>
                  ) : (
                    <a
                      href={attachment.downloadLink || "#"}
                      className="text-muted"
                      download
                    >
                      <i className="bx bxs-download"></i>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

const Typing = () => {
  const { t } = useTranslation();

  return (
    <p className="mb-0">
      {t("chat.typing")}
      <span className="animate-typing">
        <span className="dot mx-1"></span>
        <span className="dot me-1"></span>
        <span className="dot"></span>
      </span>
    </p>
  );
};
interface MessageProps {
  message: MessagesTypes;
  chatUserDetails: any;
  onEdit: (messageId: string | number, content: string) => Promise<void>;
  onDelete: (messageId: string | number) => Promise<void>;
  onMarkUnread: (messageId: string | number) => Promise<void>;
  onSetReplyData: (reply: null | MessagesTypes | undefined) => void;
  isFromMe: boolean;
  onOpenForward: (message: MessagesTypes) => void;
  isChannel: boolean;
  mentionMembers: MentionMember[];
  isBookmarked: boolean;
  isHighlighted: boolean;
  onToggleBookmark: (messageId: string | number) => Promise<void>;
}
const Message = ({
  message,
  chatUserDetails,
  onEdit,
  onDelete,
  onMarkUnread,
  onSetReplyData,
  isFromMe,
  onOpenForward,
  isChannel,
  mentionMembers,
  isBookmarked,
  isHighlighted,
  onToggleBookmark,
}: MessageProps) => {
  const { t, i18n } = useTranslation();
  const { userProfile } = useProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBookmarkSaving, setIsBookmarkSaving] = useState(false);
  const [isMarkingUnread, setIsMarkingUnread] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportReason, setReportReason] =
    useState<MessageReportReason>("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const [isReporting, setIsReporting] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const hasImages = Boolean(message.image?.length);
  const hasAttachments = Boolean(message.attachments?.length);
  const sharedContactUserId = message.isDeleted
    ? null
    : parseSharedContactMessage(message.text);
  const displayText = message.isDeleted
    ? t("chat.deletedMessage")
    : message.messageType === "system" && message.text
      ? translateKnownSystemMessage(message.text, t)
      : message.text;
  const hasText = Boolean(displayText) && !sharedContactUserId;
  const isTyping = false;

  const chatUserFullName = chatUserDetails.firstName
    ? `${chatUserDetails.firstName} ${chatUserDetails.lastName}`
    : "-";

  const myProfile = userProfile.profileImage
    ? userProfile.profileImage
    : imagePlaceholder;
  const channeluserProfile =
    message.meta.userData && message.meta.userData.profileImage
      ? message.meta.userData.profileImage
      : imagePlaceholder;
  const chatUserprofile = chatUserDetails.profileImage
    ? chatUserDetails.profileImage
    : imagePlaceholder;
  const profile = isChannel ? channeluserProfile : chatUserprofile;
  const isBotMessage = Boolean(message.meta.userData?.isBot);
  const senderUserId = String(message.meta.sender || "");
  const canOpenSenderProfile =
    isChannel &&
    !isFromMe &&
    !isBotMessage &&
    senderUserId !== "system" &&
    Boolean(message.meta.userData?.id);
  const date = new Date(message.time).toLocaleTimeString(
    i18n.resolvedLanguage,
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  );
  const isSent = message.meta.sent;
  const isReceived = message.meta.received;
  const isRead = message.meta.read;
  const isForwarded = message.meta.isForwarded;
  const channdelSenderFullname = message.meta.userData
    ? `${message.meta.userData.firstName} ${message.meta.userData.lastName}`
    : "-";
  const fullName =
    message.messageType === "system"
      ? t("chat.system")
      : isChannel
        ? channdelSenderFullname
        : chatUserFullName;
  const canModify = isFromMe && !message.isDeleted;
  const canReport = isMessageReportable({
    isFromMe,
    isDeleted: Boolean(message.isDeleted),
    messageType: message.messageType,
    senderId: senderUserId,
  });
  const onStartEdit = () => {
    setEditText(message.text || "");
    setIsEditing(true);
  };
  const onCancelEdit = () => {
    setEditText(message.text || "");
    setIsEditing(false);
  };
  const onSaveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = editText.trim();

    if (!content || content === message.text) {
      onCancelEdit();
      return;
    }

    try {
      setIsSaving(true);
      await onEdit(message.mId, content);
      setIsEditing(false);
    } catch {
      // The conversation alert displays the API error.
    } finally {
      setIsSaving(false);
    }
  };
  const onDeleteMessage = async () => {
    try {
      setIsDeleting(true);
      await onDelete(message.mId);
      setIsDeleteConfirmOpen(false);
    } catch {
      // The conversation alert displays the API error.
    } finally {
      setIsDeleting(false);
    }
  };

  const onClickReply = () => {
    onSetReplyData(message);
  };
  const isRepliedMessage = message.replyOf;

  const onForwardMessage = () => {
    onOpenForward(message);
  };
  const onCopyMessage = async () => {
    const content =
      message.text ||
      [
        ...(message.image || []).map(image => image.name),
        ...(message.attachments || []).map(attachment => attachment.name),
      ]
        .filter(Boolean)
        .join(", ");

    if (!content) {
      showErrorNotification(t("chat.noContentToCopy"));
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      showSuccessNotification(t("chat.messageCopied"));
    } catch {
      showErrorNotification(t("chat.messageCopyFailed"));
    }
  };
  const markAsUnread = async () => {
    try {
      setIsMarkingUnread(true);
      await onMarkUnread(message.mId);
    } finally {
      setIsMarkingUnread(false);
    }
  };

  const onDeleteImg = (_imageId: number | string) => {
    if (canModify) {
      setIsDeleteConfirmOpen(true);
    }
  };
  const toggleBookmark = async () => {
    try {
      setIsBookmarkSaving(true);
      await onToggleBookmark(message.mId);
    } finally {
      setIsBookmarkSaving(false);
    }
  };
  const closeReport = () => {
    if (isReporting) {
      return;
    }
    setIsReportOpen(false);
    setReportReason("harassment");
    setReportDetails("");
  };
  const submitReport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canReport) {
      setIsReportOpen(false);
      showErrorNotification(t("chat.systemCannotBeReported"));
      return;
    }

    try {
      setIsReporting(true);
      await createMessageReport({
        messageId: String(message.mId),
        reason: reportReason,
        details: reportDetails.trim() || undefined,
      });
      showSuccessNotification(t("chat.reportSubmitted"));
      setIsReportOpen(false);
      setReportReason("harassment");
      setReportDetails("");
    } catch (error) {
      showErrorNotification(String(error));
    } finally {
      setIsReporting(false);
    }
  };
  return (
    <li
      data-message-id={String(message.mId)}
      className={classnames(
        "chat-list",
        { right: isFromMe },
        { reply: isRepliedMessage },
        { "message-search-highlight": isHighlighted },
      )}
    >
      <div className="conversation-list">
        <div className="chat-avatar">
          {isBotMessage ? (
            <span
              className="avatar-title rounded-circle bg-primary text-white"
              title={t("chat.automationBot")}
              aria-label={t("chat.automationBot")}
            >
              <i className="bx bx-bot" aria-hidden="true"></i>
            </span>
          ) : canOpenSenderProfile ? (
            <Button
              type="button"
              color="link"
              className="message-avatar-button p-0 border-0"
              aria-label={t("chat.openSenderProfile", {
                name: message.meta.userData?.username || t("chat.sender"),
              })}
              onClick={() => setProfileUserId(senderUserId)}
            >
              <img src={profile} alt="" />
            </Button>
          ) : (
            <img src={isFromMe ? myProfile : profile} alt="" />
          )}
        </div>

        <div className="user-chat-content">
          {hasImages && displayText && (
            <div className="ctext-wrap">
              <div className="ctext-wrap-content">
                <p className="mb-0 ctext-content">
                  <MentionText text={displayText} members={mentionMembers} />
                </p>
              </div>
            </div>
          )}
          {isForwarded && (
            <span
              className={classnames(
                "me-1",
                "text-muted",
                "font-size-13",
                "mb-1",
                "d-block",
              )}
            >
              <i
                className={classnames(
                  "ri",
                  "ri-share-forward-line",
                  "align-middle",
                  "me-1",
                )}
              ></i>
              {t("chat.forwarded")}
            </span>
          )}

          <div className="ctext-wrap">
            {/* text message end */}

            {/* image message start */}
            {hasImages ? (
              <>
                <Images
                  images={message.image!}
                  message={message}
                  canModify={canModify}
                  onSetReplyData={onSetReplyData}
                  onForward={onForwardMessage}
                  onDeleteImg={onDeleteImg}
                  isBookmarked={isBookmarked}
                  bookmarkLoading={isBookmarkSaving}
                  onToggleBookmark={() => void toggleBookmark()}
                  canReport={canReport}
                  onReport={() => setIsReportOpen(true)}
                />
              </>
            ) : (
              <>
                <div className="ctext-wrap-content">
                  {isRepliedMessage && (
                    <RepliedMessage fullName={fullName} message={message} />
                  )}

                  {isEditing ? (
                    <form
                      className="d-flex align-items-center gap-1"
                      onSubmit={onSaveEdit}
                    >
                      <Input
                        bsSize="sm"
                        aria-label={t("chat.editMessage")}
                        autoFocus
                        disabled={isSaving}
                        maxLength={2000}
                        value={editText}
                        onChange={event => setEditText(event.target.value)}
                      />
                      <Button
                        size="sm"
                        color="primary"
                        type="submit"
                        title={t("chat.saveEdit")}
                        aria-label={t("chat.saveEdit")}
                        disabled={
                          isSaving ||
                          !editText.trim() ||
                          editText.trim() === message.text
                        }
                      >
                        {isSaving ? (
                          <Spinner size="sm" />
                        ) : (
                          <i className="bx bx-check" aria-hidden="true"></i>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        color="light"
                        type="button"
                        title={t("chat.cancelEdit")}
                        aria-label={t("chat.cancelEdit")}
                        disabled={isSaving}
                        onClick={onCancelEdit}
                      >
                        <i className="bx bx-x" aria-hidden="true"></i>
                      </Button>
                    </form>
                  ) : sharedContactUserId ? (
                    <SharedContactCard userId={sharedContactUserId} />
                  ) : hasText ? (
                    <p className="mb-0 ctext-content">
                      <MentionText
                        text={displayText!}
                        members={mentionMembers}
                      />
                    </p>
                  ) : null}

                  {/* typing start */}
                  {isTyping && <Typing />}

                  {/* typing end */}
                  {/* files message start */}
                  {hasAttachments && (
                    <Attachments attachments={message.attachments} />
                  )}
                  {/* files message end */}
                </div>
                <Menu
                  canModify={canModify}
                  onEdit={onStartEdit}
                  onForward={onForwardMessage}
                  onDelete={() => setIsDeleteConfirmOpen(true)}
                  onReply={onClickReply}
                  onCopy={() => void onCopyMessage()}
                  onMarkUnread={() => void markAsUnread()}
                  markUnreadLoading={isMarkingUnread}
                  isBookmarked={isBookmarked}
                  bookmarkLoading={isBookmarkSaving}
                  onToggleBookmark={() => void toggleBookmark()}
                  canReport={canReport}
                  onReport={() => setIsReportOpen(true)}
                />
              </>
            )}

            {/* image message end */}
          </div>
          <div className="conversation-name">
            {isFromMe ? (
              <>
                <span
                  className={classnames(
                    "me-1",
                    { "text-success": isRead },
                    { "text-muted": (isSent || isReceived) && !isRead },
                  )}
                >
                  <i
                    className={classnames(
                      "bx",
                      { "bx-check-double": isRead || isReceived },
                      { "bx-check": isSent },
                    )}
                  ></i>
                </span>
                <small className={classnames("text-muted", "mb-0", "me-2")}>
                  {date}
                </small>
                {message.isEdited && (
                  <small className="text-muted me-2">{t("chat.edited")}</small>
                )}
                {t("chat.you")}
              </>
            ) : (
              <>
                {fullName}
                <small className={classnames("text-muted", "mb-0", "ms-2")}>
                  {date}
                </small>
                {message.isEdited && (
                  <small className="text-muted ms-2">{t("chat.edited")}</small>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <Modal
        centered
        isOpen={isDeleteConfirmOpen}
        toggle={() => !isDeleting && setIsDeleteConfirmOpen(false)}
      >
        <ModalHeader
          toggle={() => !isDeleting && setIsDeleteConfirmOpen(false)}
        >
          {t("chat.deleteMessage")}
        </ModalHeader>
        <ModalBody>{t("chat.deleteForEveryone")}</ModalBody>
        <ModalFooter>
          <Button
            color="light"
            disabled={isDeleting}
            onClick={() => setIsDeleteConfirmOpen(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            color="danger"
            disabled={isDeleting}
            onClick={onDeleteMessage}
          >
            {isDeleting && <Spinner size="sm" className="me-2" />}
            {t("chat.deleteMessage")}
          </Button>
        </ModalFooter>
      </Modal>
      <Modal centered isOpen={isReportOpen && canReport} toggle={closeReport}>
        <Form onSubmit={submitReport}>
          <ModalHeader toggle={closeReport}>
            {t("chat.reportMessage")}
          </ModalHeader>
          <ModalBody>
            <p className="text-muted font-size-13">
              {t("chat.reportDescription")}
            </p>
            <FormGroup>
              <Label for={`report-reason-${message.mId}`}>
                {t("common.reason")}
              </Label>
              <Input
                id={`report-reason-${message.mId}`}
                type="select"
                value={reportReason}
                disabled={isReporting}
                onChange={event =>
                  setReportReason(event.target.value as MessageReportReason)
                }
              >
                <option value="harassment">{t("moderation.harassment")}</option>
                <option value="sexual_content">
                  {t("moderation.sexualContent")}
                </option>
                <option value="violence_or_threat">
                  {t("moderation.violenceOrThreat")}
                </option>
                <option value="spam">{t("moderation.spam")}</option>
                <option value="impersonation">
                  {t("moderation.impersonation")}
                </option>
                <option value="other">{t("moderation.other")}</option>
              </Input>
            </FormGroup>
            <FormGroup className="mb-0">
              <Label for={`report-details-${message.mId}`}>
                {t("chat.additionalDetails")}
              </Label>
              <Input
                id={`report-details-${message.mId}`}
                type="textarea"
                rows={4}
                maxLength={500}
                value={reportDetails}
                disabled={isReporting}
                placeholder={t("chat.moderationContextPlaceholder")}
                onChange={event => setReportDetails(event.target.value)}
              />
              <small className="text-muted">
                {t("admin.characters", { count: reportDetails.length })}
              </small>
            </FormGroup>
          </ModalBody>
          <ModalFooter>
            <Button
              color="light"
              type="button"
              disabled={isReporting}
              onClick={closeReport}
            >
              {t("common.cancel")}
            </Button>
            <Button color="danger" type="submit" disabled={isReporting}>
              {isReporting && <Spinner size="sm" className="me-2" />}
              {t("chat.submitReport")}
            </Button>
          </ModalFooter>
        </Form>
      </Modal>
      <UserProfileModal
        isOpen={Boolean(profileUserId)}
        userId={profileUserId}
        initialUser={message.meta.userData}
        onClose={() => setProfileUserId(null)}
      />
    </li>
  );
};

export default Message;
