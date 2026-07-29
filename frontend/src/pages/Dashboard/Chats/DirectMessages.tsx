import React from "react";
import { useTranslation } from "react-i18next";
import { UncontrolledTooltip } from "reactstrap";

//components
import AddButton from "../../../components/AddButton";

// interface
import { UserTypes } from "../../../data/chat";

// component
import ChatUser from "./ChatUser";

interface DirectMessagesProps {
  users: Array<UserTypes>;
  openAddContact: () => void;
  selectedChat: string | number;
  onSelectChat: (id: number | string) => void;
}
const DirectMessages = ({
  users,
  openAddContact,
  selectedChat,
  onSelectChat,
}: DirectMessagesProps) => {
  const { t } = useTranslation();

  /*
    add contacts
    */
  return (
    <>
      <div className="d-flex align-items-center px-4 mt-5 mb-2">
        <div className="flex-grow-1">
          <h4 className="mb-0 font-size-11 text-muted text-uppercase">
            {t("chat.directMessages")}
          </h4>
        </div>
        <div className="flex-shrink-0">
          <div id="new-message" title={t("chat.newMessage")}>
            {/* Button trigger modal */}
            <AddButton
              ariaLabel={t("chat.newDirectMessage")}
              onClick={openAddContact}
            />{" "}
            {/* contactModal */}
          </div>
          <UncontrolledTooltip target="new-message" placement="bottom">
            {t("chat.newMessage")}
          </UncontrolledTooltip>
        </div>
      </div>

      <div className="chat-message-list">
        <ul className="list-unstyled chat-list chat-user-list">
          {(users || []).map((user: UserTypes, key: number) => (
            <ChatUser
              user={user}
              key={key}
              selectedChat={selectedChat}
              onSelectChat={onSelectChat}
            />
          ))}
        </ul>
      </div>
    </>
  );
};

export default DirectMessages;
