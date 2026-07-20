import React, { useEffect } from "react";
import classnames from "classnames";
import { Alert, Button } from "reactstrap";

// hooks
import { useRedux } from "../../hooks/index";

// hooks
import { useConversationUserType } from "../../hooks/index";
import { createSelector } from "reselect";
// component
import Leftbar from "./Leftbar";
import ConversationUser from "./ConversationUser/index";
import UserProfileDetails from "./UserProfileDetails/index";
import Welcome from "./ConversationUser/Welcome";
import {
  changeSelectedChat,
  getChannels,
  getChannelDetails,
  getChatUserConversations,
  getChatUserDetails,
  getDirectMessages,
  readConversation,
} from "../../redux/actions";
import { getChatSocket } from "../../api/realtime";
import { getCurrentAuthUser } from "../../api/backendAdapters";
import { getUsers } from "../../api/chats";
import { showIncomingMessageNotification } from "../../helpers/notifications";

interface IndexProps {}
const Index = (props: IndexProps) => {
  // global store
  const { dispatch, useAppSelector } = useRedux();

  // const { selectedChat } = useAppSelector(state => ({
  //   selectedChat: state.Chats.selectedChat,
  // }));
  const errorData = createSelector(
    (state: any) => state.Chats,
    state => ({
      selectedChat: state.selectedChat,
      error: state.error,
      channels: state.channels,
      directMessages: state.directMessages,
    }),
  );
  // Inside your component
  const { selectedChat, error, channels, directMessages } =
    useAppSelector(errorData);

  const retryChatLists = () => {
    dispatch(getDirectMessages());
    dispatch(getChannels());
  };

  useEffect(() => {
    const socket = getChatSocket();

    if (!socket) {
      return;
    }

    const refreshConversationLists = () => {
      dispatch(getDirectMessages());
      dispatch(getChannels());
    };
    const openConversation = (conversationId: string, isChannel: boolean) => {
      dispatch(
        isChannel
          ? getChannelDetails(conversationId)
          : getChatUserDetails(conversationId),
      );
      dispatch(getChatUserConversations(conversationId));
      dispatch(readConversation(conversationId));
      dispatch(changeSelectedChat(conversationId));
    };
    const handleNewMessage = async (event: any) => {
      refreshConversationLists();

      const currentUser = getCurrentAuthUser();
      if (!event?.conversationId || event?.senderId === currentUser?.id) {
        return;
      }

      const channel = (channels || []).find(
        (item: any) => String(item.id) === String(event.conversationId),
      );
      const direct = (directMessages || []).find(
        (item: any) => String(item.id) === String(event.conversationId),
      );
      const conversation = channel || direct;
      const directName = [direct?.firstName, direct?.lastName]
        .filter(Boolean)
        .join(" ");
      const conversationName = channel?.name || directName || "a conversation";
      const users = event?.senderId ? await getUsers().catch(() => []) : [];
      const sender = users.find((user: any) => user.id === event.senderId);
      const senderName =
        event?.sender?.username ||
        event?.senderName ||
        sender?.username ||
        directName ||
        (event?.senderId ? "A participant" : "ellO");

      showIncomingMessageNotification({
        senderName,
        conversationName,
        content: event?.content || "New message",
        onOpen: conversation
          ? () => openConversation(String(event.conversationId), Boolean(channel))
          : undefined,
      });

      if (document.hidden) {
        const previousTitle = document.title;
        document.title = `New message from ${senderName} | ellO`;
        window.setTimeout(() => {
          document.title = previousTitle;
        }, 5000);
      }
    };
    const handleConversationLeft = (event: any) => {
      refreshConversationLists();

      if (String(event?.conversationId) === String(selectedChat)) {
        dispatch(changeSelectedChat(null));
      }
    };
    const refreshEvents = [
      "message:updated",
      "message:deleted",
      "message:read",
      "conversation:created",
      "conversation:updated",
      "participant:left",
      "participant:added",
      "participant:removed",
    ];

    refreshEvents.forEach(eventName => {
      socket.on(eventName, refreshConversationLists);
    });
    socket.on("message:new", handleNewMessage);
    socket.on("conversation:left", handleConversationLeft);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      refreshEvents.forEach(eventName => {
        socket.off(eventName, refreshConversationLists);
      });
      socket.off("message:new", handleNewMessage);
      socket.off("conversation:left", handleConversationLeft);
    };
  }, [channels, directMessages, dispatch, selectedChat]);

  const { isChannel } = useConversationUserType();

  return (
    <>
      <Leftbar />

      <div
        className={classnames("user-chat", "w-100", "overflow-hidden", {
          "user-chat-show": selectedChat,
        })}
        id="user-chat"
      >
        <div className="user-chat-overlay" id="user-chat-overlay"></div>
        {error && (
          <Alert
            color="danger"
            className="rounded-0 mb-0 d-flex align-items-center justify-content-between gap-3"
          >
            <span>{error}</span>
            <Button color="danger" outline size="sm" onClick={retryChatLists}>
              Retry
            </Button>
          </Alert>
        )}
        {selectedChat !== null ? (
          <div className="chat-content d-lg-flex">
            <div className="w-100 overflow-hidden position-relative">
              <ConversationUser isChannel={isChannel} />
            </div>
            <UserProfileDetails isChannel={isChannel} />
          </div>
        ) : (
          <Welcome />
        )}
      </div>
    </>
  );
};

export default Index;
