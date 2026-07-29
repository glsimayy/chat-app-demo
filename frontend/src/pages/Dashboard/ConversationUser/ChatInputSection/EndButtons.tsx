import React from "react";
import { useTranslation } from "react-i18next";

import { Button, Spinner } from "reactstrap";
import { VoiceRecorderStatus } from "../../../../features/voice-message/useVoiceRecorder";

interface EndButtonsProps {
  disabled: boolean;
  voiceStatus: VoiceRecorderStatus;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
}
const EndButtons = ({
  disabled,
  voiceStatus,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
}: EndButtonsProps) => {
  const { t } = useTranslation();

  return (
    <div className="chat-input-links ms-2 gap-md-1">
      {voiceStatus === "recording" ? (
        <>
          <div className="links-list-item">
            <Button
              color="none"
              type="button"
              title={t("chat.cancelRecording")}
              aria-label={t("chat.cancelVoiceRecording")}
              className="btn btn-link btn-lg text-danger"
              onClick={onCancelRecording}
            >
              <i className="bx bx-trash align-middle"></i>
            </Button>
          </div>
          <div className="links-list-item">
            <Button
              color="danger"
              type="button"
              title={t("chat.stopRecording")}
              aria-label={t("chat.stopVoiceRecording")}
              className="btn btn-danger btn-lg chat-send"
              onClick={onStopRecording}
            >
              <i className="bx bx-stop align-middle"></i>
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="links-list-item">
            <Button
              color="none"
              type="button"
              disabled={voiceStatus === "requesting"}
              title={t("chat.recordVoice")}
              aria-label={t("chat.recordVoice")}
              className="btn btn-link text-decoration-none btn-lg"
              onClick={onStartRecording}
            >
              {voiceStatus === "requesting" ? (
                <Spinner size="sm" />
              ) : (
                <i className="bx bxs-microphone align-middle"></i>
              )}
            </Button>
          </div>
          <div className="links-list-item">
            <Button
              color="primary"
              type="submit"
              disabled={disabled || voiceStatus === "requesting"}
              title={t("chat.sendMessage")}
              aria-label={t("chat.sendMessage")}
              className="btn btn-primary btn-lg chat-send waves-effect waves-light"
            >
              <i className="bx bxs-send align-middle"></i>
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default EndButtons;
