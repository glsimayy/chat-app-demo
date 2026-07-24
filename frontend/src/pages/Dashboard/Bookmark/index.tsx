import React, { useEffect } from "react";
import { createSelector } from "reselect";

import AppSimpleBar from "../../../components/AppSimpleBar";
import LeftbarTitle from "../../../components/LeftbarTitle";
import Loader from "../../../components/Loader";
import { TABS } from "../../../constants";
import { BookMarkTypes } from "../../../data/bookmarks";
import { useRedux } from "../../../hooks";
import {
  changeSelectedChat,
  changeTab,
  deleteBookmark,
  getBookmarks,
  getChannelDetails,
  getChatUserConversations,
  getChatUserDetails,
  readConversation,
  updateBookmark,
} from "../../../redux/actions";
import { savePendingMessageFocus } from "../../../utils/messageFocus";
import BookMark from "./BookMark";

const bookmarkState = createSelector(
  (state: any) => state.Bookmarks,
  state => ({
    bookmarksList: state.bookmarks,
    getBookmarksLoading: state.getBookmarksLoading,
    isBookmarkDeleted: state.isBookmarkDeleted,
    isBookmarkUpdated: state.isBookmarkUpdated,
  }),
);

const Bookmark = () => {
  const { dispatch, useAppSelector } = useRedux();
  const {
    bookmarksList,
    getBookmarksLoading,
    isBookmarkDeleted,
    isBookmarkUpdated,
  } = useAppSelector(bookmarkState);

  useEffect(() => {
    dispatch(getBookmarks());
  }, [dispatch]);

  useEffect(() => {
    const refreshBookmarks = () => dispatch(getBookmarks());
    window.addEventListener("ello:bookmarks-updated", refreshBookmarks);

    return () => {
      window.removeEventListener("ello:bookmarks-updated", refreshBookmarks);
    };
  }, [dispatch]);

  useEffect(() => {
    if (isBookmarkDeleted || isBookmarkUpdated) {
      dispatch(getBookmarks());
    }
  }, [dispatch, isBookmarkDeleted, isBookmarkUpdated]);

  const onUpdate = (messageId: string, data: { title: string | null }) => {
    dispatch(updateBookmark(messageId, data));
  };

  const onDelete = (messageId: string) => {
    dispatch(deleteBookmark(messageId));
  };

  const onOpen = (bookmark: BookMarkTypes) => {
    const targetConversationId =
      bookmark.conversation.type === "management"
        ? bookmark.conversation.parentConversationId
        : bookmark.conversation.id;

    if (!targetConversationId) {
      return;
    }

    savePendingMessageFocus({
      conversationId: bookmark.conversation.id,
      messageId: bookmark.messageId,
      conversationType: bookmark.conversation.type,
      parentConversationId: bookmark.conversation.parentConversationId,
    });

    dispatch(
      bookmark.conversation.type === "direct"
        ? getChatUserDetails(targetConversationId)
        : getChannelDetails(targetConversationId),
    );
    dispatch(getChatUserConversations(targetConversationId));
    dispatch(readConversation(bookmark.conversation.id));
    dispatch(changeSelectedChat(targetConversationId));
    dispatch(changeTab(TABS.CHAT));
  };

  return (
    <div className="position-relative">
      {getBookmarksLoading && <Loader />}
      <LeftbarTitle title="Saved Messages" />
      <AppSimpleBar className="chat-message-list chat-bookmark-list">
        {!getBookmarksLoading && (bookmarksList || []).length === 0 && (
          <div className="bookmark-empty-state">
            <i className="bx bx-bookmark" aria-hidden="true"></i>
            <strong>No saved messages</strong>
            <span>Save a message from its actions menu.</span>
          </div>
        )}
        <ul className="list-unstyled chat-list bookmark-message-list">
          {(bookmarksList || []).map((bookmark: BookMarkTypes) => (
            <BookMark
              key={bookmark.id}
              bookmark={bookmark}
              onOpen={onOpen}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </ul>
      </AppSimpleBar>
    </div>
  );
};

export default Bookmark;
