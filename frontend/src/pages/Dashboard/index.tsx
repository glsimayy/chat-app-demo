import React, { useEffect } from "react";
import classnames from "classnames";

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
  getDirectMessages,
} from "../../redux/actions";
import { getChatSocket } from "../../api/realtime";

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
    }),
  );
  // Inside your component
  const { selectedChat } = useAppSelector(errorData);

  useEffect(() => {
    const socket = getChatSocket();

    if (!socket) {
      return;
    }

    const refreshConversationLists = () => {
      dispatch(getDirectMessages());
      dispatch(getChannels());
    };
    const handleConversationLeft = (event: any) => {
      refreshConversationLists();

      if (String(event?.conversationId) === String(selectedChat)) {
        dispatch(changeSelectedChat(null));
      }
    };
    const refreshEvents = [
      "message:new",
      "message:updated",
      "message:deleted",
      "message:read",
      "conversation:created",
      "conversation:updated",
      "participant:left",
    ];

    refreshEvents.forEach(eventName => {
      socket.on(eventName, refreshConversationLists);
    });
    socket.on("conversation:left", handleConversationLeft);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      refreshEvents.forEach(eventName => {
        socket.off(eventName, refreshConversationLists);
      });
      socket.off("conversation:left", handleConversationLeft);
    };
  }, [dispatch, selectedChat]);

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
