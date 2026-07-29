import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button, Modal, ModalHeader, ModalBody } from "reactstrap";
import classnames from "classnames";

// hooks
import { useRedux } from "../hooks/index";

// components
import AppSimpleBar from "./AppSimpleBar";

// interfaces
import { MessagesTypes, ContactTypes } from "../data";

// hooks
import { useProfile, useContacts } from "../hooks";
import { createSelector } from "reselect";
//utils
import { DivideByKeyResultTypes, divideByKey } from "../utils";
import EmptyStateContacts from "./EmptyStateResult";
interface ForwardMessageProps {
  forwardData: null | MessagesTypes | undefined;
  chatUserDetails: any;
}
const ForwardMessage = ({
  forwardData,
  chatUserDetails,
}: ForwardMessageProps) => {
  const { t } = useTranslation();
  const { userProfile } = useProfile();

  const replyUserName = chatUserDetails.firstName
    ? `${chatUserDetails.firstName} ${chatUserDetails.lastName}`
    : "-";
  const isReplyFromMe =
    forwardData && forwardData.meta.sender + "" === userProfile.uid + "";

  return (
    <div className="replymessage-block mb-2">
      <h5 className="conversation-name">
        {isReplyFromMe ? t("chat.you") : replyUserName}
      </h5>
      {forwardData?.text && <p className="mb-0">{forwardData?.text}</p>}

      {(forwardData?.image || forwardData?.attachments) && (
        <p className="mb-0">
          {forwardData?.attachments &&
            !forwardData?.image &&
            t("forward.file", { count: forwardData.attachments.length })}
          {forwardData?.image &&
            !forwardData?.attachments &&
            t("forward.image", { count: forwardData.image.length })}
          {forwardData?.image &&
            forwardData?.attachments &&
            t("forward.filesAndImages", {
              files: t("forward.file", {
                count: forwardData.attachments.length,
              }),
              images: t("forward.image", {
                count: forwardData.image.length,
              }),
            })}
        </p>
      )}
    </div>
  );
};

interface ContactItemProps {
  contact: ContactTypes;
  selected: boolean;
  onSelectContact: (id: string | number, selected: boolean) => void;
  onSend: (contact: Array<number | string>) => void;
}
const ContactItem = ({
  contact,
  selected,
  onSelectContact,
  onSend,
}: ContactItemProps) => {
  const { t } = useTranslation();
  const fullName = `${contact.firstName} ${contact.lastName}`;
  const onClick = () => {
    onSelectContact(contact.id, !selected);
    if (!selected) {
      onSend([contact.id]);
    }
  };

  return (
    <li>
      <div className="d-flex align-items-center">
        <div className="flex-grow-1">
          <h5 className="font-size-14 m-0">{fullName}</h5>
        </div>
        <div className="flex-shrink-0">
          {!selected ? (
            <Button size="sm" color="primary" type="button" onClick={onClick}>
              {t("forward.send")}
            </Button>
          ) : (
            <Button size="sm" color="light" type="button" onClick={onClick}>
              {t("forward.undo")}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
};
interface CharacterItemProps {
  letterContacts: DivideByKeyResultTypes;
  index: number;
  totalContacts: number;
  selectedContacts: Array<number | string>;
  onSelectContact: (id: string | number, selected: boolean) => void;
  onSend: (contact: Array<number | string>) => void;
}

const CharacterItem = ({
  letterContacts,
  index,
  totalContacts,
  selectedContacts,
  onSelectContact,
  onSend,
}: CharacterItemProps) => {
  return (
    <div className={classnames({ "mt-3": index !== 0 })}>
      <div className="contact-list-title">{letterContacts.letter}</div>

      <ul
        className={classnames("list-unstyled", "contact-list", {
          "mb-0": index + 1 === totalContacts,
        })}
      >
        {(letterContacts.data || []).map((contact: any, key: number) => {
          const selected: boolean = selectedContacts.includes(contact.id);
          return (
            <ContactItem
              contact={contact}
              key={key}
              selected={selected}
              onSelectContact={onSelectContact}
              onSend={onSend}
            />
          );
        })}
      </ul>
    </div>
  );
};

interface ForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  forwardData: null | MessagesTypes | undefined;
  chatUserDetails: any;
  onForward: (data: any) => void;
}
const ForwardModal = ({
  isOpen,
  onClose,
  forwardData,
  chatUserDetails,
  onForward,
}: ForwardModalProps) => {
  const { t } = useTranslation();
  // global store
  const { useAppSelector } = useRedux();

  // const { contactsList } = useAppSelector(state => ({
  //   contactsList: state.Contacts.contacts,
  // }));

  const errorData = createSelector(
    (state: any) => state.Contacts,
    state => ({
      contactsList: state.contacts,
    }),
  );
  // Inside your component
  const { contactsList } = useAppSelector(errorData);

  /*
  contacts hook
  */
  const { categorizedContacts, totalContacts } = useContacts();
  const [contacts, setContacts] = useState<any>([]);
  useEffect(() => {
    setContacts(categorizedContacts);
  }, [categorizedContacts]);

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
    const formattedContacts = divideByKey("firstName", filteredContacts);
    setContacts(formattedContacts);
  };

  const totalC = (contacts || []).length;

  /*
  select contacts
  */
  const [selectedContacts, setSelectedContacts] = useState<
    Array<string | number>
  >([]);
  const onSelectContact = (id: string | number, selected: boolean) => {
    let modifiedList: Array<string | number> = [...selectedContacts];
    if (selected) {
      modifiedList = [...modifiedList, id];
    } else {
      modifiedList = modifiedList.filter(m => m + "" !== id + "");
    }
    setSelectedContacts(modifiedList);
  };

  /*
  share all
  */
  const onShareAll = () => {
    const allIds = (contactsList || []).map((c: ContactTypes) => c.id);
    setSelectedContacts(allIds);
    const data = {
      contacts: [...allIds],
      message: message,
    };
    onForward(data);
  };

  /*
  message
  */
  const [message, setMessage] = useState<string | null | undefined>();
  const onChangeMessage = (value: string) => {
    setMessage(value);
  };

  /*
  submit data
  */
  const onSend = (contacts: Array<number | string>) => {
    const data = {
      contacts: [...contacts],
      message: message,
    };
    onForward(data);
  };

  return (
    <Modal
      isOpen={isOpen}
      toggle={onClose}
      centered
      className="forwardModal"
      tabIndex={-1}
    >
      <ModalHeader
        className="modal-title-custom text-white font-size-16"
        toggle={onClose}
      >
        {t("forward.shareMessage")}
      </ModalHeader>
      <ModalBody className="p-4">
        <div>
          <ForwardMessage
            forwardData={forwardData}
            chatUserDetails={chatUserDetails}
          />
          <textarea
            className="form-control"
            placeholder={t("chat.typeMessage")}
            rows={2}
            value={message || ""}
            onChange={(e: any) => {
              onChangeMessage(e.target.value);
            }}
          ></textarea>
        </div>
        <hr className="my-4" />
        <div className="input-group mb-3">
          <input
            type="text"
            className="form-control bg-light border-0 pe-0"
            placeholder={t("forward.search")}
            aria-label={t("forward.searchAria")}
            aria-describedby="forwardSearchbtn-addon"
            value={search || ""}
            onChange={(e: any) => {
              onChangeSearch(e.target.value);
            }}
          />
          <button
            className="btn btn-light"
            type="button"
            id="forwardSearchbtn-addon"
          >
            <i className="bx bx-search align-middle"></i>
          </button>
        </div>
        {totalC === 0 ? (
          <EmptyStateContacts searchedText={search} />
        ) : (
          <>
            <div className="d-flex align-items-center px-1">
              <div className="flex-grow-1">
                <h4 className="mb-0 font-size-11 text-muted text-uppercase">
                  {t("forward.contacts")}
                </h4>
              </div>
              <div className="flex-shrink-0">
                <Button
                  size="sm"
                  color="primary"
                  type="button"
                  onClick={onShareAll}
                >
                  {t("forward.shareAll")}
                </Button>
              </div>
            </div>
            <AppSimpleBar style={{ maxHeight: "150px" }} className="mx-n4 px-1">
              {(contacts || []).map(
                (letterContacts: DivideByKeyResultTypes, key: number) => (
                  <CharacterItem
                    letterContacts={letterContacts}
                    key={key}
                    index={key}
                    totalContacts={totalContacts}
                    selectedContacts={selectedContacts}
                    onSelectContact={onSelectContact}
                    onSend={onSend}
                  />
                ),
              )}
            </AppSimpleBar>
          </>
        )}
      </ModalBody>
    </Modal>
  );
};

export default ForwardModal;
