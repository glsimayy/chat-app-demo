import React from "react";
import { useTranslation } from "react-i18next";

// interface
import { MessagesTypes } from "../../../data/messages";

// hooks
import { useProfile } from "../../../hooks";

interface RepliedMessageProps {
  message: MessagesTypes;
  fullName: string;
}
function RepliedMessage({ message, fullName }: RepliedMessageProps) {
  const { t } = useTranslation();
  const { userProfile } = useProfile();
  const reply = message.replyOf;
  const imageCount = reply?.image?.length || 0;
  const fileCount = reply?.attachments?.length || 0;
  const attachmentSummary = [
    imageCount ? t("forward.image", { count: imageCount }) : "",
    fileCount ? t("forward.file", { count: fileCount }) : "",
  ]
    .filter(Boolean)
    .join(" & ");

  const isReplyFromMe = reply?.meta.sender + "" === userProfile.uid + "";
  const replySenderName = reply?.meta.userData?.firstName
    ? `${reply.meta.userData.firstName} ${reply.meta.userData.lastName}`.trim()
    : fullName;

  return (
    <div className="replymessage-block mb-2 d-flex align-items-start">
      <div className="flex-grow-1">
        <h5 className="conversation-name">
          {isReplyFromMe ? t("chat.you") : replySenderName}
        </h5>
        {reply?.text && <p className="mb-0">{reply.text}</p>}
        {attachmentSummary && <p className="mb-0">{attachmentSummary}</p>}
      </div>
    </div>
  );
}

export default RepliedMessage;
