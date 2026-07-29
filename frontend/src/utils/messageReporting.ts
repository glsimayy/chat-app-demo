interface MessageReportability {
  isFromMe: boolean;
  isDeleted: boolean;
  messageType?: string;
  senderId?: string | number | null;
}

export const isMessageReportable = ({
  isFromMe,
  isDeleted,
  messageType,
  senderId,
}: MessageReportability) => {
  const normalizedType = String(messageType ?? "")
    .trim()
    .toLowerCase();
  const normalizedSenderId = String(senderId ?? "")
    .trim()
    .toLowerCase();

  return (
    !isFromMe &&
    !isDeleted &&
    normalizedType !== "system" &&
    normalizedSenderId !== "system"
  );
};
