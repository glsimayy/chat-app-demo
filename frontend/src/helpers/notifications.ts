import { toast } from "react-toastify";

const showSuccessNotification = (message: string) => {
  toast.success(message);
};

const showErrorNotification = (error: string) => {
  toast.error(error);
};

const showIncomingMessageNotification = ({
  senderName,
  conversationName,
  content,
  onOpen,
}: {
  senderName: string;
  conversationName: string;
  content: string;
  onOpen?: () => void;
}) => {
  const preview = content.trim().replace(/\s+/g, " ").slice(0, 90);
  const suffix = content.trim().length > 90 ? "..." : "";

  toast.info(
    `${senderName} in ${conversationName}: ${preview || "New message"}${suffix}`,
    {
      autoClose: 6500,
      closeOnClick: true,
      pauseOnHover: true,
      className: "incoming-message-toast",
      onClick: onOpen,
    },
  );
};

export {
  showSuccessNotification,
  showErrorNotification,
  showIncomingMessageNotification,
};
