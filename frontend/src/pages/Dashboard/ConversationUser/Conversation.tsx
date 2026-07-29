import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

// hooks
import { useRedux } from "../../../hooks/index";

// hooks
import { useProfile } from "../../../hooks";
import { createSelector } from "reselect";
// components
import AppSimpleBar from "../../../components/AppSimpleBar";
import Loader from "../../../components/Loader";
import Message from "./Message";
// import Day from "./Day";

// interface
import { MessagesTypes } from "../../../data/messages";
import ForwardModal from "../../../components/ForwardModal";
import {
  createBookmark,
  deleteBookmark as removeMessageBookmark,
  getBookmarks as getMessageBookmarks,
} from "../../../api/bookmarks";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../../../helpers/notifications";
import { BookMarkTypes } from "../../../data/bookmarks";
import { MentionMember } from "../../../utils/mentions";

// actions
import { forwardMessage } from "../../../redux/actions";
interface ConversationProps {
  chatUserConversations: any;
  chatUserDetails: any;
  onEdit: (messageId: string | number, content: string) => Promise<void>;
  onDelete: (messageId: string | number) => Promise<void>;
  onMarkUnread: (messageId: string | number) => Promise<void>;
  onSetReplyData: (reply: null | MessagesTypes | undefined) => void;
  isChannel: boolean;
  mentionMembers: MentionMember[];
  focusedMessageId: string | number | null;
}
const Conversation = ({
  chatUserDetails,
  chatUserConversations,
  onEdit,
  onDelete,
  onMarkUnread,
  onSetReplyData,
  isChannel,
  mentionMembers,
  focusedMessageId,
}: ConversationProps) => {
  const { t } = useTranslation();
  // global store
  const { dispatch, useAppSelector } = useRedux();

  const { userProfile } = useProfile();

  const errorData = createSelector(
    (state: any) => state.Chats,
    state => ({
      getUserConversationsLoading: state.getUserConversationsLoading,
      isMessageForwarded: state.isMessageForwarded,
    }),
  );
  // Inside your component
  const { getUserConversationsLoading, isMessageForwarded } =
    useAppSelector(errorData);

  const messages = useMemo(
    () =>
      chatUserConversations.messages && chatUserConversations.messages.length
        ? chatUserConversations.messages
        : [],
    [chatUserConversations.messages],
  );
  const [bookmarkedMessageIds, setBookmarkedMessageIds] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    let active = true;

    getMessageBookmarks()
      .then((bookmarks: any) => {
        if (active) {
          setBookmarkedMessageIds(
            new Set(
              (bookmarks as BookMarkTypes[]).map(bookmark =>
                String(bookmark.messageId),
              ),
            ),
          );
        }
      })
      .catch(() => {
        if (active) {
          setBookmarkedMessageIds(new Set());
        }
      });

    return () => {
      active = false;
    };
  }, [chatUserConversations.conversationId]);

  const toggleBookmark = async (messageId: string | number) => {
    const normalizedMessageId = String(messageId);
    const isBookmarked = bookmarkedMessageIds.has(normalizedMessageId);

    try {
      if (isBookmarked) {
        await removeMessageBookmark(normalizedMessageId);
      } else {
        await createBookmark(normalizedMessageId);
      }

      setBookmarkedMessageIds(current => {
        const next = new Set(current);
        if (isBookmarked) {
          next.delete(normalizedMessageId);
        } else {
          next.add(normalizedMessageId);
        }
        return next;
      });
      window.dispatchEvent(new Event("ello:bookmarks-updated"));
      showSuccessNotification(
        t(isBookmarked ? "bookmark.removed" : "bookmark.saved"),
      );
    } catch (bookmarkError: any) {
      showErrorNotification(
        String(bookmarkError || t("bookmark.updateFailed")),
      );
      throw bookmarkError;
    }
  };

  const ref = useRef<any>();
  const scrollElement = useCallback(() => {
    if (ref && ref.current) {
      const listEle = document.getElementById("chat-conversation-list");
      let offsetHeight = 0;
      if (listEle) {
        offsetHeight = listEle.scrollHeight - window.innerHeight + 250;
      }
      if (offsetHeight) {
        ref.current
          .getScrollElement()
          .scrollTo({ top: offsetHeight, behavior: "smooth" });
      }
    }
  }, [ref]);

  useEffect(() => {
    if (ref && ref.current) {
      ref.current.recalculate();
    }
  }, []);
  useEffect(() => {
    if (chatUserConversations.messages && !focusedMessageId) {
      scrollElement();
    }
  }, [chatUserConversations.messages, focusedMessageId, scrollElement]);

  useEffect(() => {
    if (!focusedMessageId) {
      return;
    }

    const timer = window.setTimeout(() => {
      const messageElement = document.querySelector<HTMLElement>(
        `[data-message-id="${String(focusedMessageId)}"]`,
      );
      const scrollContainer = ref.current?.getScrollElement?.();
      if (!messageElement || !scrollContainer) {
        return;
      }

      const messageBounds = messageElement.getBoundingClientRect();
      const containerBounds = scrollContainer.getBoundingClientRect();
      const targetTop =
        scrollContainer.scrollTop +
        messageBounds.top -
        containerBounds.top -
        (scrollContainer.clientHeight - messageBounds.height) / 2;
      scrollContainer.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "auto",
      });
    }, 50);

    return () => window.clearTimeout(timer);
  }, [focusedMessageId, messages]);

  /*
  forward message
  */
  const [forwardData, setForwardData] = useState<
    null | MessagesTypes | undefined
  >();
  const [isOpenForward, setIsOpenForward] = useState<boolean>(false);
  const onOpenForward = (message: MessagesTypes) => {
    setForwardData(message);
    setIsOpenForward(true);
  };
  const onCloseForward = () => {
    setIsOpenForward(false);
  };

  const onForwardMessage = (data: any) => {
    const params = {
      contacts: data.contacts,
      message: data.message,
      forwardedMessage: forwardData,
    };
    dispatch(forwardMessage(params));
  };
  useEffect(() => {
    if (isMessageForwarded) {
      setIsOpenForward(false);
    }
  }, [isMessageForwarded]);

  return (
    <AppSimpleBar
      scrollRef={ref}
      className="chat-conversation p-3 p-lg-4 positin-relative"
    >
      {getUserConversationsLoading && <Loader />}
      <ul
        className="list-unstyled chat-conversation-list"
        id="chat-conversation-list"
      >
        {(messages || []).map((message: MessagesTypes, key: number) => {
          const isFromMe = message.meta.sender + "" === userProfile.uid + "";
          return (
            <Message
              message={message}
              key={key}
              chatUserDetails={chatUserDetails}
              onEdit={onEdit}
              onDelete={onDelete}
              onMarkUnread={onMarkUnread}
              onSetReplyData={onSetReplyData}
              isFromMe={isFromMe}
              onOpenForward={onOpenForward}
              isChannel={isChannel}
              mentionMembers={mentionMembers}
              isBookmarked={bookmarkedMessageIds.has(String(message.mId))}
              isHighlighted={
                String(focusedMessageId || "") === String(message.mId)
              }
              onToggleBookmark={toggleBookmark}
            />
          );
        })}
        {/*  <Day /> */}
      </ul>
      {isOpenForward && (
        <ForwardModal
          isOpen={isOpenForward}
          onClose={onCloseForward}
          forwardData={forwardData}
          chatUserDetails={chatUserDetails}
          onForward={onForwardMessage}
        />
      )}
    </AppSimpleBar>
  );
};

export default Conversation;
