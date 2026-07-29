import React from "react";
import { useTranslation } from "react-i18next";

import { Button, UncontrolledTooltip } from "reactstrap";

// emoji picker
import Picker from "emoji-picker-react";

interface StartButtonsProps {
  onToggle: () => void;
  onEmojiClick: any;
  emojiPicker: any;
  setemojiPicker: any;
}

const StartButtons = ({
  onToggle,
  onEmojiClick,
  emojiPicker,
  setemojiPicker,
}: StartButtonsProps) => {
  const { t } = useTranslation();

  return (
    <div className="chat-input-links me-md-2">
      <div className="links-list-item" id="more-menu">
        <Button
          type="button"
          className="btn btn-link text-decoration-none btn-lg waves-effect"
          onClick={onToggle}
          color="none"
          title={t("chat.moreOptions")}
          aria-label={t("chat.moreOptions")}
        >
          <i className="bx bx-dots-horizontal-rounded align-middle"></i>
        </Button>
      </div>
      <UncontrolledTooltip target="more-menu" placement="top">
        {t("chat.more")}
      </UncontrolledTooltip>
      {emojiPicker && (
        <Picker onEmojiClick={onEmojiClick} width={350} height={382} />
      )}
      <div className="links-list-item" id="emoji">
        <Button
          type="button"
          className="btn btn-link text-decoration-none btn-lg waves-effect emoji-btn"
          id="emoji-btn"
          color="none"
          onClick={() => setemojiPicker(!emojiPicker)}
          title={t("chat.chooseEmoji")}
          aria-label={t("chat.chooseEmoji")}
        >
          <i className="bx bx-smile align-middle"></i>
        </Button>
      </div>
    </div>
  );
};

export default StartButtons;
