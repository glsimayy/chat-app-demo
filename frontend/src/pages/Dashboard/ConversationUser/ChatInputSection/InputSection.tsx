import React from "react";

import { Input } from "reactstrap";

interface InputSectionProps {
  value: null | string;
  onChange: (value: string, caretPosition: number) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  onKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
  onCaretChange: (caretPosition: number) => void;
  mentionListId?: string;
  activeMentionOptionId?: string;
}

const InputSection = ({
  value,
  onChange,
  inputRef,
  onKeyDown,
  onCaretChange,
  mentionListId,
  activeMentionOptionId,
}: InputSectionProps) => {
  const updateCaret = (event: React.SyntheticEvent<HTMLInputElement>) => {
    onCaretChange(event.currentTarget.selectionStart ?? value?.length ?? 0);
  };

  return (
    <div className="position-relative">
      <Input
        innerRef={inputRef}
        type="text"
        className="form-control form-control-lg chat-input"
        id="chat-input"
        aria-label="Message"
        aria-autocomplete={mentionListId ? "list" : undefined}
        aria-controls={mentionListId}
        aria-expanded={Boolean(mentionListId)}
        aria-activedescendant={activeMentionOptionId}
        placeholder="Type your message..."
        value={value || ""}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          onChange(
            event.target.value,
            event.target.selectionStart ?? event.target.value.length,
          );
        }}
        onClick={updateCaret}
        onKeyDown={onKeyDown}
        onKeyUp={updateCaret}
        onSelect={updateCaret}
        autoComplete="off"
      />
    </div>
  );
};
export default InputSection;
