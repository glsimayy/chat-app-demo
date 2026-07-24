import React, { useState } from "react";
import classnames from "classnames";
import { createSelector } from "reselect";
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
} from "reactstrap";
// hooks
import { useRedux } from "../../../hooks/index";

// actions
import {
  changeSelectedChat,
  getChannels,
  getDirectMessages,
  toggleUserDetailsTab,
  getChatUserDetails,
  getChatUserConversations,
  getFavourites,
  getArchiveContact,
  toggleFavouriteContact,
  toggleArchiveContact,
} from "../../../redux/actions";
import {
  createDirectConversation,
  deleteUserMessages as deleteConversation,
} from "../../../api/chats";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../../../helpers/notifications";

// components
import AppSimpleBar from "../../../components/AppSimpleBar";
import Loader from "../../../components/Loader";
import ProfileUser from "./ProfileUser";
import Actions from "./Actions";
import BasicDetails from "./BasicDetails";
import Groups from "./Groups";
import Media from "../../../components/Media";
import AttachedFiles from "../../../components/AttachedFiles";
import Status from "./Status";
import GroupManagement from "../ConversationUser/GroupManagement";
import { useAudioCall } from "../../../features/audio-call/AudioCallProvider";

interface IndexProps {
  isChannel: boolean;
}
const Index = ({ isChannel }: IndexProps) => {
  // global store
  const { dispatch, useAppSelector } = useRedux();
  const { startCall } = useAudioCall();

  const errorData = createSelector(
    (state: any) => state.Chats,

    state => ({
      chatUserDetails: state.chatUserDetails,
      getUserDetailsLoading: state.getUserDetailsLoading,
      isOpenUserDetails: state.isOpenUserDetails,
    }),
  );
  const { chatUserDetails, getUserDetailsLoading, isOpenUserDetails } =
    useAppSelector(errorData);

  /*
  close tab
  */
  const onCloseUserDetails = () => {
    dispatch(toggleUserDetailsTab(false));
  };

  const onOpenVideo = () => {
    showErrorNotification("Video calls are not available in this release");
  };

  const onOpenAudio = () => {
    const targetUserId = chatUserDetails?.participantId;
    if (!chatUserDetails?.id || !targetUserId) {
      showErrorNotification("This user is not available for an audio call");
      return;
    }

    const displayName =
      [chatUserDetails.firstName, chatUserDetails.lastName]
        .filter(Boolean)
        .join(" ") ||
      chatUserDetails.username ||
      "User";
    void startCall({
      conversationId: String(chatUserDetails.id),
      targetUserId: String(targetUserId),
      displayName,
      profileImage: chatUserDetails.profileImage,
    });
  };

  const onToggleBookmark = () => {
    dispatch(toggleFavouriteContact(chatUserDetails.id));
  };

  /*
  archive
  */
  const onToggleArchive = () => {
    dispatch(toggleArchiveContact(chatUserDetails.id));
    dispatch(toggleUserDetailsTab(false));
    dispatch(changeSelectedChat(null));
  };

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const onDeleteConversation = async () => {
    try {
      setIsDeleting(true);
      await deleteConversation(chatUserDetails.id);
      setIsDeleteOpen(false);
      dispatch(toggleUserDetailsTab(false));
      dispatch(changeSelectedChat(null));
      dispatch(getDirectMessages());
      dispatch(getFavourites());
      dispatch(getArchiveContact());
      showSuccessNotification("Conversation deleted");
    } catch (error) {
      showErrorNotification(
        String(error || "Conversation could not be deleted"),
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const participantStateKey = (chatUserDetails.members || [])
    .map(
      (member: any) =>
        `${member.userId}:${member.role}:${member.leftAt || "active"}`,
    )
    .join("|");

  const refreshGroup = () => {
    dispatch(getChatUserDetails(chatUserDetails.id));
    dispatch(getChannels());
  };

  const leaveGroup = () => {
    dispatch(toggleUserDetailsTab(false));
    dispatch(changeSelectedChat(null));
    dispatch(getChannels());
  };

  const openDirectChat = async (userId: string) => {
    const conversation: any = await createDirectConversation(userId);

    if (!conversation?.id) {
      throw new Error("Direct conversation could not be created");
    }

    dispatch(toggleUserDetailsTab(false));
    dispatch(changeSelectedChat(conversation.id));
    dispatch(getChatUserDetails(conversation.id));
    dispatch(getChatUserConversations(conversation.id));
    dispatch(getDirectMessages());
  };

  return (
    <>
      <div
        className={classnames("user-profile-sidebar", {
          "d-block": isOpenUserDetails,
        })}
      >
        <div className="position-relative">
          {getUserDetailsLoading && <Loader />}

          <ProfileUser
            onCloseUserDetails={onCloseUserDetails}
            chatUserDetails={chatUserDetails}
            onOpenVideo={onOpenVideo}
            onOpenAudio={onOpenAudio}
            isChannel={isChannel}
          />
          {/* <!-- End profile user --> */}

          {/* <!-- Start user-profile-desc --> */}
          <AppSimpleBar className="p-4 user-profile-desc">
            {!isChannel ? (
              <>
                <Actions
                  onOpenVideo={onOpenVideo}
                  onOpenAudio={onOpenAudio}
                  onToggleBookmark={onToggleBookmark}
                  onToggleArchive={onToggleArchive}
                  onDelete={() => setIsDeleteOpen(true)}
                  isBookmarked={Boolean(chatUserDetails.isBookmarked)}
                  isArchived={Boolean(chatUserDetails.isArchived)}
                />
                <Status about={chatUserDetails.about} />
                <BasicDetails chatUserDetails={chatUserDetails} />
                <hr className="my-4" />
                <Groups chatUserDetails={chatUserDetails} />
                <hr className="my-4" />
                <Media media={chatUserDetails.media} limit={3} />
                <hr className="my-4" />
                <AttachedFiles attachedFiles={chatUserDetails.attachedFiles} />
              </>
            ) : (
              <>
                <GroupManagement
                  conversation={chatUserDetails}
                  participantStateKey={participantStateKey}
                  onChanged={refreshGroup}
                  onLeft={leaveGroup}
                  onOpenDirect={openDirectChat}
                />
                <hr className="my-4" />
                <Media media={chatUserDetails.media} limit={3} />
                <hr className="my-4" />
                <AttachedFiles attachedFiles={chatUserDetails.attachedFiles} />
              </>
            )}
          </AppSimpleBar>
          {/* <!-- end user-profile-desc --> */}
          <Modal
            isOpen={isDeleteOpen}
            toggle={() => !isDeleting && setIsDeleteOpen(false)}
            centered
          >
            <ModalHeader toggle={() => !isDeleting && setIsDeleteOpen(false)}>
              Delete conversation?
            </ModalHeader>
            <ModalBody>
              This conversation will be removed from your chat list. The other
              participant will keep their copy.
            </ModalBody>
            <ModalFooter>
              <Button
                type="button"
                color="light"
                disabled={isDeleting}
                onClick={() => setIsDeleteOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                color="danger"
                disabled={isDeleting}
                onClick={onDeleteConversation}
              >
                {isDeleting && <Spinner size="sm" className="me-2" />}
                Delete
              </Button>
            </ModalFooter>
          </Modal>
        </div>
      </div>
    </>
  );
};

export default Index;
