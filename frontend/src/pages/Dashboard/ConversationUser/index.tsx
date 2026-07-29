import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button } from "reactstrap";

// hooks
import { useRedux } from "../../../hooks/index";
import { createSelector } from "reselect";
// actions
import {
  toggleUserDetailsTab,
  getChannels,
  getDirectMessages,
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
import MessageSearchPanel from "./MessageSearchPanel";
import CatchUpPanel from "./CatchUpPanel";

// interface
import { MessagesTypes } from "../../../data/messages";

import { getChatSocket } from "../../../api/realtime";
import {
  deleteMessage as deleteMessageApi,
  getManagementConversation,
  markMessageAsUnread as markMessageAsUnreadApi,
  updateMessage as updateMessageApi,
} from "../../../api/chats";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../../../helpers/notifications";
import { getCurrentAuthUser } from "../../../api/backendAdapters";
import { createClientMessageId } from "../../../utils/clientMessageId";
import {
  clearPendingMessageFocus,
  readPendingMessageFocus,
} from "../../../utils/messageFocus";

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
  const pendingFocusOpeningRef = useRef(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [realtimeError, setRealtimeError] = useState("");
  const [conversationMode, setConversationMode] = useState<
    "group" | "management"
  >("group");
  const [managementConversation, setManagementConversation] =
    useState<any>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCatchUpOpen, setIsCatchUpOpen] = useState(false);
  const [focusedMessageId, setFocusedMessageId] = useState<
    string | number | null
  >(null);
  const activeParticipantIds = new Set(
    (chatUserDetails.members || [])
      .filter((member: any) => !member.leftAt)
      .map((member: any) => member.userId),
  );
  const onlineParticipantCount = Array.from(onlineUserIds).filter(userId =>
    activeParticipantIds.has(userId),
  ).length;
  const currentAuthUser = getCurrentAuthUser();
  const currentParticipant = (chatUserDetails.members || []).find(
    (member: any) => member.userId === currentAuthUser?.id && !member.leftAt,
  );
  const canAccessManagementChat =
    isChannel &&
    !currentAuthUser?.isBot &&
    (currentAuthUser?.role === "admin" ||
      currentParticipant?.role === "owner" ||
      currentParticipant?.role === "manager");
  const activeConversationId =
    conversationMode === "management" && managementConversation?.id
      ? managementConversation.id
      : chatUserDetails.id;
  const activeChatDetails =
    conversationMode === "management" && managementConversation
      ? {
          ...chatUserDetails,
          id: managementConversation.id,
          name: "Manager Chat",
          members: managementConversation.participants || [],
        }
      : chatUserDetails;
  const groupIsActive =
    !isChannel ||
    String(chatUserDetails.status || "active").toLowerCase() === "active";
  const canSendToGroup =
    !isChannel ||
    Boolean(chatUserDetails.memberCanSendMessages) ||
    currentAuthUser?.role === "admin" ||
    currentParticipant?.role === "owner" ||
    currentParticipant?.role === "manager";
  const canSendMessage =
    groupIsActive &&
    (conversationMode === "management"
      ? canAccessManagementChat
      : canSendToGroup);

  useEffect(() => {
    setConversationMode("group");
    setManagementConversation(null);
    setIsSearchOpen(false);
    setIsCatchUpOpen(false);
    setFocusedMessageId(null);
  }, [chatUserDetails.id]);

  const focusMessage = useCallback((messageId: string | number) => {
    setFocusedMessageId(messageId);
    window.setTimeout(() => {
      setFocusedMessageId(current =>
        String(current) === String(messageId) ? null : current,
      );
    }, 2400);
  }, []);

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
    const conversationId = activeConversationId;

    if (socket?.connected && conversationId && typingActiveRef.current) {
      socket.emit("typing:stop", { conversationId });
    }
    typingActiveRef.current = false;

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }, [activeConversationId]);

  const onTyping = useCallback(
    (value: string) => {
      const socket = getChatSocket();
      const conversationId = activeConversationId;

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
    [activeConversationId, stopTyping],
  );

  const refreshCurrentConversation = useCallback(() => {
    if (!activeConversationId || !chatUserDetails.id) {
      return;
    }

    dispatch(getChatUserConversations(activeConversationId));
    dispatch(getChatUserDetails(chatUserDetails.id));
    dispatch(getChannels());
  }, [activeConversationId, chatUserDetails.id, dispatch]);

  const onSend = (data: any) => {
    const clientMessageId = createClientMessageId();
    const replyTarget = data.replyOf || replyData;
    const replyToMessageId =
      data.replyToMessageId ||
      (replyTarget?.mId ? String(replyTarget.mId) : undefined);
    let params: any = {
      text: data.text && data.text,
      time: new Date().toISOString(),
      image: data.image && data.image,
      newimage: data.newimage && data.newimage,
      attachments: data.attachments && data.attachments,
      files: data.files && data.files,
      clientMessageId,
      replyToMessageId,
      meta: {
        receiver: activeConversationId,
        sender: userProfile.uid,
      },
    };

    if (replyTarget) {
      params["replyOf"] = replyTarget;
    }

    const content = data.text || "";
    const socket = getChatSocket();
    const sendWithRestFallback = () => dispatch(onSendMessage(params));

    setRealtimeError("");
    stopTyping();

    if (data.files?.length) {
      sendWithRestFallback();
    } else if (socket?.connected) {
      socket.timeout(5000).emit(
        "message:send",
        {
          conversationId: activeConversationId,
          content,
          clientMessageId,
          replyToMessageId,
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
      dispatch(getChatUserConversations(activeConversationId));
    }
  }, [
    dispatch,
    isUserMessageSent,
    activeConversationId,
    isMessageForwarded,
    isUserMessagesDeleted,
    isImageDeleted,
  ]);

  useEffect(() => {
    const conversationId = activeConversationId;
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

    const refreshConversation = (event: any) => {
      const eventConversationId = event?.conversationId || event?.id;

      if (
        eventConversationId === conversationId ||
        eventConversationId === chatUserDetails.id
      ) {
        refreshCurrentConversation();
      }
    };
    const handleParticipantRemoved = (event: any) => {
      if (event?.conversationId !== conversationId) {
        return;
      }

      setOnlineUserIds(current => {
        const next = new Set(current);
        next.delete(event.userId);
        return next;
      });
      setTypingUserIds(current => {
        const next = new Set(current);
        next.delete(event.userId);
        return next;
      });
      refreshCurrentConversation();
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
    socket.on("participant:left", handleParticipantRemoved);
    socket.on("participant:added", refreshConversation);
    socket.on("participant:removed", handleParticipantRemoved);
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
      socket.off("participant:left", handleParticipantRemoved);
      socket.off("participant:added", refreshConversation);
      socket.off("participant:removed", handleParticipantRemoved);
      socket.off("presence:snapshot", handlePresenceSnapshot);
      socket.off("presence:online", handlePresenceOnline);
      socket.off("presence:offline", handlePresenceOffline);
      socket.off("typing:started", handleTypingStarted);
      socket.off("typing:stopped", handleTypingStopped);
      socket.off("exception", handleSocketError);
    };
  }, [
    activeConversationId,
    chatUserDetails.id,
    refreshCurrentConversation,
    userProfile?.accessToken,
    userProfile?.uid,
  ]);

  const onEditMessage = async (messageId: string | number, content: string) => {
    try {
      setRealtimeError("");
      await updateMessageApi(activeConversationId, messageId, content);
      refreshCurrentConversation();
    } catch (error: any) {
      setRealtimeError(String(error || "Message could not be updated"));
      throw error;
    }
  };

  const onDeleteMessage = async (messageId: string | number) => {
    try {
      setRealtimeError("");
      await deleteMessageApi(activeConversationId, messageId);
      refreshCurrentConversation();
    } catch (error: any) {
      setRealtimeError(String(error || "Message could not be deleted"));
      throw error;
    }
  };

  const onMarkMessageAsUnread = async (messageId: string | number) => {
    try {
      setRealtimeError("");
      await markMessageAsUnreadApi(activeConversationId, messageId);
      dispatch(getDirectMessages());
      dispatch(getChannels());
      showSuccessNotification("Conversation marked as unread");
    } catch (error: any) {
      const message = String(
        error || "Conversation could not be marked unread",
      );
      setRealtimeError(message);
      showErrorNotification(message);
      throw error;
    }
  };

  const showGroupChat = () => {
    setConversationMode("group");
    setRealtimeError("");
    dispatch(getChatUserConversations(chatUserDetails.id));
  };

  const showManagementChat = async () => {
    if (!canAccessManagementChat || !chatUserDetails.id) {
      return;
    }

    try {
      setRealtimeError("");
      const management: any = await getManagementConversation(
        chatUserDetails.id,
      );
      setManagementConversation(management);
      setConversationMode("management");
      dispatch(getChatUserConversations(management.id));
    } catch (error: any) {
      setRealtimeError(String(error || "Management chat could not be opened"));
    }
  };

  useEffect(() => {
    const pending = readPendingMessageFocus();

    if (!pending || !chatUserDetails.id) {
      return;
    }

    const rootConversationId =
      pending.conversationType === "management"
        ? pending.parentConversationId
        : pending.conversationId;

    if (String(rootConversationId) !== String(chatUserDetails.id)) {
      return;
    }

    const targetMessageIsLoaded =
      String(chatUserConversations.conversationId) ===
        String(pending.conversationId) &&
      (chatUserConversations.messages || []).some(
        (message: MessagesTypes) =>
          String(message.mId) === String(pending.messageId),
      );

    if (pending.conversationType !== "management") {
      if (!targetMessageIsLoaded) {
        return;
      }

      clearPendingMessageFocus();
      focusMessage(pending.messageId);
      return;
    }

    if (
      String(managementConversation?.id || "") ===
      String(pending.conversationId)
    ) {
      if (targetMessageIsLoaded) {
        clearPendingMessageFocus();
        focusMessage(pending.messageId);
      }
      return;
    }

    if (pendingFocusOpeningRef.current) {
      return;
    }

    pendingFocusOpeningRef.current = true;
    getManagementConversation(chatUserDetails.id)
      .then((management: any) => {
        if (String(management?.id) !== String(pending.conversationId)) {
          throw new Error("Management conversation could not be matched");
        }

        setManagementConversation(management);
        setConversationMode("management");
        dispatch(getChatUserConversations(management.id));
      })
      .catch((error: any) => {
        setRealtimeError(String(error || "Saved message could not be opened"));
      })
      .finally(() => {
        pendingFocusOpeningRef.current = false;
      });
  }, [
    chatUserConversations.conversationId,
    chatUserConversations.messages,
    chatUserDetails.id,
    dispatch,
    focusMessage,
    managementConversation?.id,
  ]);

  return (
    <div
      className={`conversation-shell ${
        isChannel
          ? conversationMode === "management"
            ? "conversation-shell-management"
            : "conversation-shell-group"
          : ""
      }`}
    >
      <UserHead
        chatUserDetails={chatUserDetails}
        onOpenUserDetails={onOpenUserDetails}
        onToggleSearch={() => {
          setIsSearchOpen(current => !current);
          setIsCatchUpOpen(false);
        }}
        onToggleCatchUp={() => {
          setIsCatchUpOpen(current => !current);
          setIsSearchOpen(false);
        }}
        isSearchOpen={isSearchOpen}
        isCatchUpOpen={isCatchUpOpen}
        isChannel={isChannel}
      />
      {isCatchUpOpen && activeConversationId && (
        <CatchUpPanel
          conversationId={activeConversationId}
          onClose={() => setIsCatchUpOpen(false)}
          onSelectMessage={focusMessage}
        />
      )}
      {isSearchOpen && activeConversationId && (
        <MessageSearchPanel
          conversationId={activeConversationId}
          onClose={() => setIsSearchOpen(false)}
          onSelectMessage={focusMessage}
        />
      )}
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
          <span className="text-muted">{onlineParticipantCount} online</span>
        )}
        {typingUserIds.size > 0 && (
          <span className="text-primary">Someone is typing...</span>
        )}
      </div>
      {isChannel && (
        <div className="conversation-context-strip border-bottom px-3 py-2 d-flex flex-wrap gap-2 align-items-center">
          {canAccessManagementChat ? (
            <div
              className="btn-group btn-group-sm"
              role="group"
              aria-label="Conversation view"
            >
              <Button
                color={conversationMode === "group" ? "primary" : "light"}
                onClick={showGroupChat}
              >
                <i
                  className="bx bx-message-square-dots me-1"
                  aria-hidden="true"
                ></i>
                Group Chat
              </Button>
              <Button
                color={conversationMode === "management" ? "warning" : "light"}
                onClick={showManagementChat}
              >
                <i className="bx bx-lock-alt me-1" aria-hidden="true"></i>
                Manager Chat
              </Button>
            </div>
          ) : (
            <strong className="conversation-context-label">
              <i
                className="bx bx-message-square-dots me-1"
                aria-hidden="true"
              ></i>
              Group Chat
            </strong>
          )}
          <small className="conversation-context-copy">
            {conversationMode === "management"
              ? "Private channel | Visible only to group management"
              : "Shared channel | Visible to all group members"}
          </small>
        </div>
      )}
      {realtimeError && (
        <Alert
          color="danger"
          toggle={() => setRealtimeError("")}
          className="rounded-0 py-2 px-3 mb-0 font-size-12"
        >
          {realtimeError}
        </Alert>
      )}
      <Conversation
        chatUserConversations={chatUserConversations}
        chatUserDetails={activeChatDetails}
        onEdit={onEditMessage}
        onDelete={onDeleteMessage}
        onMarkUnread={onMarkMessageAsUnread}
        onSetReplyData={onSetReplyData}
        isChannel={isChannel}
        focusedMessageId={focusedMessageId}
      />
      <ChatInputSection
        onSend={onSend}
        onTyping={onTyping}
        replyData={replyData}
        onSetReplyData={onSetReplyData}
        chatUserDetails={activeChatDetails}
        draftKey={`${currentAuthUser?.id || "anonymous"}:${activeConversationId || "none"}`}
        canSend={canSendMessage}
        disabledMessage={
          !groupIsActive
            ? `This group is ${chatUserDetails.status}.`
            : "Members cannot send messages in this group. Only group management can send."
        }
      />
    </div>
  );
};

export default Index;
