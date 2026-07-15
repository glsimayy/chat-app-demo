import React from "react";

import { Button } from "reactstrap";
interface EndButtonsProps {
  disabled: boolean;
}
const EndButtons = ({ disabled }: EndButtonsProps) => {
  return (
    <div className="chat-input-links ms-2 gap-md-1">
      <div className="links-list-item">
        <Button
          color="primary"
          type="submit"
          disabled={disabled}
          title="Send message"
          aria-label="Send message"
          className="btn btn-primary btn-lg chat-send waves-effect waves-light"
        >
          <i className="bx bxs-send align-middle"></i>
        </Button>
      </div>
    </div>
  );
};

export default EndButtons;
