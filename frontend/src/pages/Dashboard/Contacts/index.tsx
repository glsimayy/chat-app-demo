import React, { useEffect, useState } from "react";
import { Alert } from "reactstrap";

// hooks
import { useRedux } from "../../../hooks/index";
import { createSelector } from "reselect";
// components
import Loader from "../../../components/Loader";
import AppSimpleBar from "../../../components/AppSimpleBar";
import InviteContactModal from "../../../components/InviteContactModal";
import EmptyStateResult from "../../../components/EmptyStateResult";
import ListHeader from "./ListHeader";
import Contact from "./Contact";

// actions
import {
  getContacts,
  inviteContact,
  resetContacts,
  getChatUserDetails,
  getChatUserConversations,
  changeSelectedChat,
  getDirectMessages,
} from "../../../redux/actions";
import { createDirectConversation } from "../../../api/chats";

//utils
import { divideByKey, DivideByKeyResultTypes } from "../../../utils";

interface IndexProps {}

const Index = (props: IndexProps) => {
  // global store
  const { dispatch, useAppSelector } = useRedux();

  const errorData = createSelector(
    (state: any) => state.Contacts,
    state => ({
      contactsList: state.contacts,
      getContactsLoading: state.getContactsLoading,
      isContactInvited: state.isContactInvited,
    }),
  );
  // Inside your component
  const { contactsList, getContactsLoading, isContactInvited } =
    useAppSelector(errorData);

  // get contacts

  useEffect(() => {
    dispatch(getContacts());
  }, [dispatch]);

  const [contacts, setContacts] = useState<Array<any>>([]);
  const [contactsData, setContactsData] = useState<Array<any>>([]);
  useEffect(() => {
    setContacts(contactsList || []);
  }, [contactsList]);

  useEffect(() => {
    setContactsData(
      contacts.length > 0 ? divideByKey("firstName", contacts) : [],
    );
  }, [contacts]);

  /*
  add contact modal handeling
  */
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const openModal = () => {
    setIsOpen(true);
  };
  const closeModal = () => {
    setIsOpen(false);
  };

  /*
  onInvite handeling
  */
  const onInviteContact = (data: any) => {
    dispatch(inviteContact(data));
  };
  useEffect(() => {
    if (isContactInvited) {
      setIsOpen(false);
      setTimeout(() => {
        dispatch(resetContacts("isContactInvited", false));
      }, 1000);
    }
  }, [dispatch, isContactInvited]);

  /*
  contact search
  */
  const [search, setSearch] = useState("");
  const onChangeSearch = (value: string) => {
    setSearch(value);
    let modifiedContacts = [...contactsList];
    let filteredContacts = (modifiedContacts || []).filter((c: any) =>
      c["firstName"].toLowerCase().includes(value.toLowerCase()),
    );
    setContacts(filteredContacts);
  };

  const totalC = (contacts || []).length;
  const [openingContactId, setOpeningContactId] = useState<
    string | number | null
  >(null);
  const [openConversationError, setOpenConversationError] = useState("");
  const onSelectChat = async (contactId: string | number) => {
    try {
      setOpeningContactId(contactId);
      setOpenConversationError("");
      const conversation: any = await createDirectConversation(contactId);

      dispatch(getChatUserDetails(conversation.id));
      dispatch(getChatUserConversations(conversation.id));
      dispatch(changeSelectedChat(conversation.id));
      dispatch(getDirectMessages());
    } catch (error: any) {
      setOpenConversationError(
        String(error || "Conversation could not be opened"),
      );
    } finally {
      setOpeningContactId(null);
    }
  };

  return (
    <>
      <div className="position-relative">
        {(getContactsLoading || openingContactId !== null) && <Loader />}
        <ListHeader
          search={search}
          onChangeSearch={onChangeSearch}
          openModal={openModal}
        />

        {openConversationError && (
          <Alert
            color="danger"
            className="mx-4 py-2"
            toggle={() => setOpenConversationError("")}
          >
            {openConversationError}
          </Alert>
        )}

        <AppSimpleBar className="chat-message-list chat-group-list">
          <div>
            {totalC === 0 ? (
              <EmptyStateResult searchedText={search} />
            ) : (
              (contactsData || []).map(
                (letterContacts: DivideByKeyResultTypes, key: number) => (
                  <Contact
                    letterContacts={letterContacts}
                    key={key}
                    index={key}
                    onSelectChat={onSelectChat}
                  />
                ),
              )
            )}
          </div>
        </AppSimpleBar>
      </div>
      <InviteContactModal
        isOpen={isOpen}
        onClose={closeModal}
        onInvite={onInviteContact}
      />
    </>
  );
};

export default Index;
