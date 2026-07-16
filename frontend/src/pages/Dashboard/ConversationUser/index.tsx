import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "reactstrap";

// hooks
import { useRedux } from "../../../hooks/index";
import { createSelector } from "reselect";
// actions
import {
  toggleUserDetailsTab,
  getChannels,
  getChatUserDetails,
  getChatUserConversations,
  onSendMessage,
} from "../../../redux/actions";

// hooks
import { useProfile } from "../../../hooks";

// components
import UserHead from "./UserHead";
import Conversation from "./Conversation";
import ChatInputSection from "./ChatInputSection/index";
import GroupManagement from "./GroupManagement";

// interface
import { MessagesTypes } from "../../../data/messages";

import { getChatSocket } from "../../../api/realtime";
import {
  deleteMessage as deleteMessageApi,
  updateMessage as updateMessageApi,
} from "../../../api/chats";

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
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingActiveRef = useRef(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [realtimeError, setRealtimeError] = useState("");
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());

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
  const stopTyping = useCallback(() => {
    const socket = getChatSocket();
    const conversationId = chatUserDetails.id;

    if (socket?.connected && conversationId && typingActiveRef.current) {
      socket.emit("typing:stop", { conversationId });
    }
    typingActiveRef.current = false;

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }, [chatUserDetails.id]);

  const onTyping = useCallback(
    (value: string) => {
      const socket = getChatSocket();
      const conversationId = chatUserDetails.id;

      if (!socket?.connected || !conversationId) {
        return;
      }

      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }

      if (!value.trim()) {
        stopTyping();
        return;
      }

      if (!typingActiveRef.current) {
        socket.emit("typing:start", { conversationId });
        typingActiveRef.current = true;
      }
      typingTimerRef.current = setTimeout(stopTyping, 1200);
    },
    [chatUserDetails.id, stopTyping],
  );

  const refreshCurrentConversation = useCallback(() => {
    if (!chatUserDetails.id) {
      return;
    }

    dispatch(getChatUserConversations(chatUserDetails.id));
    dispatch(getChatUserDetails(chatUserDetails.id));
    dispatch(getChannels());
  }, [chatUserDetails.id, dispatch]);

  const onSend = (data: any) => {
    const clientMessageId = crypto.randomUUID();
    let params: any = {
      text: data.text && data.text,
      time: new Date().toISOString(),
      image: data.image && data.image,
      newimage: data.newimage && data.newimage,
      attachments: data.attachments && data.attachments,
      clientMessageId,
      meta: {
        receiver: chatUserDetails.id,
        sender: userProfile.uid,
      },
    };

    if (replyData && replyData !== null) {
      params["replyOf"] = replyData;
    }

    const content =
      data.text ||
      (data.attachments?.length ? "[attachment]" : "") ||
      (data.image?.length || data.newimage?.length ? "[image]" : "");
    const socket = getChatSocket();
    const sendWithRestFallback = () => dispatch(onSendMessage(params));

    setRealtimeError("");
    stopTyping();

    if (socket?.connected) {
      socket.timeout(5000).emit(
        "message:send",
        {
          conversationId: chatUserDetails.id,
          content,
          clientMessageId,
        },
        (timeoutError: Error | null, response: any) => {
          if (timeoutError) {
            setRealtimeError(
              "Socket response timed out. Retrying through the REST API.",
            );
            sendWithRestFallback();
            return;
          }

          if (!response?.success) {
            setRealtimeError(response?.message || "Message could not be sent");
            return;
          }

          refreshCurrentConversation();
        },
      );
    } else {
      sendWithRestFallback();
    }

    setReplyData(null);
  };

  useEffect(() => {
    if (
      isUserMessageSent ||
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

    const handleAck = (response: any) => {
      if (!response?.success) {
        setRealtimeError(response?.message || "Realtime sync failed");
      }
    };
    const joinConversation = () => {
      setSocketConnected(true);
      setRealtimeError("");
      socket.emit(
        "conversation:sync",
        { conversationIds: [conversationId] },
        handleAck,
      );
      socket.emit("conversation:join", { conversationId }, handleAck);
      joinedConversationRef.current = conversationId;
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
      typingActiveRef.current = false;
      setOnlineUserIds(new Set());
      setTypingUserIds(new Set());
    };

    const refreshConversation = (message: any) => {
      if (message?.conversationId === conversationId) {
        refreshCurrentConversation();
      }
    };

    const handlePresenceSnapshot = (event: any) => {
      if (event?.conversationId !== conversationId) {
        return;
      }

      setOnlineUserIds(
        new Set(
          (event.users || [])
            .filter((user: any) => user.online)
            .map((user: any) => user.userId),
        ),
      );
    };
    const handlePresenceOnline = (event: any) => {
      if (event?.conversationId === conversationId) {
        setOnlineUserIds(current => new Set(current).add(event.userId));
      }
    };
    const handlePresenceOffline = (event: any) => {
      if (event?.conversationId === conversationId) {
        setOnlineUserIds(current => {
          const next = new Set(current);
          next.delete(event.userId);
          return next;
        });
      }
    };
    const handleTypingStarted = (event: any) => {
      if (
        event?.conversationId === conversationId &&
        event.userId !== userProfile?.uid
      ) {
        setTypingUserIds(current => new Set(current).add(event.userId));
      }
    };
    const handleTypingStopped = (event: any) => {
      if (event?.conversationId === conversationId) {
        setTypingUserIds(current => {
          const next = new Set(current);
          next.delete(event.userId);
          return next;
        });
      }
    };
    const handleSocketError = (event: any) => {
      setRealtimeError(event?.message || "Realtime request failed");
    };

    socket.on("connect", joinConversation);
    socket.on("disconnect", handleDisconnect);
    socket.on("message:new", refreshConversation);
    socket.on("message:updated", refreshConversation);
    socket.on("message:deleted", refreshConversation);
    socket.on("conversation:updated", refreshConversation);
    socket.on("participant:left", refreshConversation);
    socket.on("participant:added", refreshConversation);
    socket.on("participant:removed", refreshConversation);
    socket.on("presence:snapshot", handlePresenceSnapshot);
    socket.on("presence:online", handlePresenceOnline);
    socket.on("presence:offline", handlePresenceOffline);
    socket.on("typing:started", handleTypingStarted);
    socket.on("typing:stopped", handleTypingStopped);
    socket.on("exception", handleSocketError);

    if (socket.connected) {
      joinConversation();
    } else {
      socket.connect();
    }

    return () => {
      if (socket.connected) {
        socket.emit("conversation:unsubscribe", { conversationId });
      }
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      socket.off("connect", joinConversation);
      socket.off("disconnect", handleDisconnect);
      socket.off("message:new", refreshConversation);
      socket.off("message:updated", refreshConversation);
      socket.off("message:deleted", refreshConversation);
      socket.off("conversation:updated", refreshConversation);
      socket.off("participant:left", refreshConversation);
      socket.off("participant:added", refreshConversation);
      socket.off("participant:removed", refreshConversation);
      socket.off("presence:snapshot", handlePresenceSnapshot);
      socket.off("presence:online", handlePresenceOnline);
      socket.off("presence:offline", handlePresenceOffline);
      socket.off("typing:started", handleTypingStarted);
      socket.off("typing:stopped", handleTypingStopped);
      socket.off("exception", handleSocketError);
    };
  }, [
    chatUserDetails.id,
    refreshCurrentConversation,
    userProfile?.accessToken,
    userProfile?.uid,
  ]);

  const onEditMessage = async (
    messageId: string | number,
    content: string,
  ) => {
    try {
      setRealtimeError("");
      await updateMessageApi(chatUserDetails.id, messageId, content);
      refreshCurrentConversation();
    } catch (error: any) {
      setRealtimeError(String(error || "Message could not be updated"));
      throw error;
    }
  };

  const onDeleteMessage = async (messageId: string | number) => {
    try {
      setRealtimeError("");
      await deleteMessageApi(chatUserDetails.id, messageId);
      refreshCurrentConversation();
    } catch (error: any) {
      setRealtimeError(String(error || "Message could not be deleted"));
      throw error;
    }
  };

  return (
    <div className="conversation-shell">
      <UserHead
        chatUserDetails={chatUserDetails}
        onOpenUserDetails={onOpenUserDetails}
        isChannel={isChannel}
      />
      <div className="border-bottom px-3 py-2 d-flex flex-wrap gap-3 align-items-center font-size-12">
        <span className={socketConnected ? "text-success" : "text-muted"}>
          <i
            className={
              socketConnected ? "bx bxs-circle me-1" : "bx bx-circle me-1"
            }
            aria-hidden="true"
          ></i>
          {socketConnected ? "Realtime connected" : "REST fallback active"}
        </span>
        {isChannel && (
          <span className="text-muted">{onlineUserIds.size} online</span>
        )}
        {typingUserIds.size > 0 && (
          <span className="text-primary">Someone is typing...</span>
        )}
      </div>
      {realtimeError && (
        <Alert
          color="danger"
          toggle={() => setRealtimeError("")}
          className="rounded-0 py-2 px-3 mb-0 font-size-12"
        >
          {realtimeError}
        </Alert>
      )}
      {isChannel && chatUserDetails.id && (
        <GroupManagement
          conversationId={chatUserDetails.id}
          onChanged={refreshCurrentConversation}
        />
      )}
      <Conversation
        chatUserConversations={chatUserConversations}
        chatUserDetails={chatUserDetails}
        onEdit={onEditMessage}
        onDelete={onDeleteMessage}
        onSetReplyData={onSetReplyData}
        isChannel={isChannel}
      />
      <ChatInputSection
        onSend={onSend}
        onTyping={onTyping}
        replyData={replyData}
        onSetReplyData={onSetReplyData}
        chatUserDetails={chatUserDetails}
      />
    </div>
  );
};

export default Index;
