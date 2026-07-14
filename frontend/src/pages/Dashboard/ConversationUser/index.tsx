import React, { useEffect, useRef, useState } from "react";

// hooks
import { useRedux } from "../../../hooks/index";
import { createSelector } from "reselect";
// actions
import {
  toggleUserDetailsTab,
  getChatUserConversations,
  onSendMessage,
  receiveMessage,
  readMessage,
  receiveMessageFromUser,
  deleteMessage,
  deleteUserMessages,
  toggleArchiveContact,
} from "../../../redux/actions";

// hooks
import { useProfile } from "../../../hooks";

// components
import UserHead from "./UserHead";
import Conversation from "./Conversation";
import ChatInputSection from "./ChatInputSection/index";

// interface
import { MessagesTypes } from "../../../data/messages";

// dummy data
import { pinnedTabs } from "../../../data/index";
import { getChatSocket } from "../../../api/realtime";

interface IndexProps {
  isChannel: boolean;
}
const Index = ({ isChannel }: IndexProps) => {
  // global store
  const { dispatch, useAppSelector } = useRedux();

  const errorData = createSelector(
    (state: any) => state.Chats,
    state => ({
      chatUserDetails: state.chatUserDetails,
      chatUserConversations: state.chatUserConversations,
      isUserMessageSent: state.isUserMessageSent,
      isMessageDeleted: state.isMessageDeleted,
      isMessageForwarded: state.isMessageForwarded,
      isUserMessagesDeleted: state.isUserMessagesDeleted,
      isImageDeleted: state.isImageDeleted,
    }),
  );
  // Inside your component
  const {
    chatUserDetails,
    chatUserConversations,
    isUserMessageSent,
    isMessageDeleted,
    isMessageForwarded,
    isUserMessagesDeleted,
    isImageDeleted,
  } = useAppSelector(errorData);

  const onOpenUserDetails = () => {
    dispatch(toggleUserDetailsTab(true));
  };

  /*
  hooks
  */
  const { userProfile } = useProfile();
  const joinedConversationRef = useRef<string | number | null>(null);

  /*
  reply handeling
  */
  const [replyData, setReplyData] = useState<
    null | MessagesTypes | undefined
  >();
  const onSetReplyData = (reply: null | MessagesTypes | undefined) => {
    setReplyData(reply);
  };

  /*
  send message
  */
  const onSend = (data: any) => {
    let params: any = {
      text: data.text && data.text,
      time: new Date().toISOString(),
      image: data.image && data.image,
      newimage: data.newimage && data.newimage,
      attachments: data.attachments && data.attachments,
      meta: {
        receiver: chatUserDetails.id,
        sender: userProfile.uid,
      },
    };

    if (replyData && replyData !== null) {
      params["replyOf"] = replyData;
    }

    dispatch(onSendMessage(params));
    if (!isChannel) {
      setTimeout(() => {
        dispatch(receiveMessage(chatUserDetails.id));
      }, 1000);
      setTimeout(() => {
        dispatch(readMessage(chatUserDetails.id));
      }, 1500);
      setTimeout(() => {
        dispatch(receiveMessageFromUser(chatUserDetails.id));
      }, 2000);
    }
    setReplyData(null);
  };

  useEffect(() => {
    if (
      isUserMessageSent ||
      isMessageDeleted ||
      isMessageForwarded ||
      isUserMessagesDeleted ||
      isImageDeleted
    ) {
      dispatch(getChatUserConversations(chatUserDetails.id));
    }
  }, [
    dispatch,
    isUserMessageSent,
    chatUserDetails,
    isMessageDeleted,
    isMessageForwarded,
    isUserMessagesDeleted,
    isImageDeleted,
  ]);

  useEffect(() => {
    const conversationId = chatUserDetails.id;
    const socket = getChatSocket();

    if (!conversationId || !socket) {
      return;
    }

    const joinConversation = () => {
      socket.emit("conversation:join", { conversationId });
      joinedConversationRef.current = conversationId;
    };

    const refreshConversation = (message: any) => {
      if (message?.conversationId === conversationId) {
        dispatch(getChatUserConversations(conversationId));
      }
    };

    socket.on("connect", joinConversation);
    socket.on("message:new", refreshConversation);
    socket.on("message:updated", refreshConversation);
    socket.on("message:deleted", refreshConversation);
    socket.on("conversation:updated", refreshConversation);
    socket.on("participant:left", refreshConversation);

    if (socket.connected) {
      joinConversation();
    } else {
      socket.connect();
    }

    return () => {
      socket.emit("conversation:unsubscribe", { conversationId });
      socket.off("connect", joinConversation);
      socket.off("message:new", refreshConversation);
      socket.off("message:updated", refreshConversation);
      socket.off("message:deleted", refreshConversation);
      socket.off("conversation:updated", refreshConversation);
      socket.off("participant:left", refreshConversation);
    };
  }, [dispatch, chatUserDetails.id, userProfile?.accessToken]);

  const onDeleteMessage = (messageId: string | number) => {
    dispatch(deleteMessage(chatUserDetails.id, messageId));
  };

  const onDeleteUserMessages = () => {
    dispatch(deleteUserMessages(chatUserDetails.id));
  };

  const onToggleArchive = () => {
    dispatch(toggleArchiveContact(chatUserDetails.id));
  };
  return (
    <>
      <UserHead
        chatUserDetails={chatUserDetails}
        pinnedTabs={pinnedTabs}
        onOpenUserDetails={onOpenUserDetails}
        onDelete={onDeleteUserMessages}
        isChannel={isChannel}
        onToggleArchive={onToggleArchive}
      />
      <Conversation
        chatUserConversations={chatUserConversations}
        chatUserDetails={chatUserDetails}
        onDelete={onDeleteMessage}
        onSetReplyData={onSetReplyData}
        isChannel={isChannel}
      />
      <ChatInputSection
        onSend={onSend}
        replyData={replyData}
        onSetReplyData={onSetReplyData}
        chatUserDetails={chatUserDetails}
      />
    </>
  );
};

export default Index;
