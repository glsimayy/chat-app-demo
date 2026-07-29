import React from "react";
import { useTranslation } from "react-i18next";
import { UncontrolledTooltip } from "reactstrap";

// interface
import { ChannelTypes } from "../../../data/chat";

// components
import AddButton from "../../../components/AddButton";
import ChatChannel from "./ChatChannel";

interface ChanelsProps {
  channels: Array<ChannelTypes>;
  canCreateChannel: boolean;
  openCreateChannel: () => void;
  selectedChat: string | number;
  onSelectChat: (id: number | string, isChannel?: boolean) => void;
}
const Chanels = ({
  channels,
  canCreateChannel,
  openCreateChannel,
  selectedChat,
  onSelectChat,
}: ChanelsProps) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="d-flex align-items-center px-4 mt-5 mb-2">
        <div className="flex-grow-1">
          <h4 className="mb-0 font-size-11 text-muted text-uppercase">
            {t("chat.channels")}
          </h4>
        </div>
        {canCreateChannel && (
          <div className="flex-shrink-0">
            <div id="create-group">
              <AddButton
                ariaLabel={t("chat.createGroup")}
                onClick={openCreateChannel}
              />
            </div>
            <UncontrolledTooltip target="create-group" placement="bottom">
              {t("chat.createGroup")}
            </UncontrolledTooltip>
          </div>
        )}
      </div>
      <div className="chat-message-list">
        <ul className="list-unstyled chat-list chat-user-list mb-3">
          {(channels || []).map((channel: ChannelTypes, key: number) => (
            <ChatChannel
              channel={channel}
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

export default Chanels;
