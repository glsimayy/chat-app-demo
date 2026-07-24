import React, { useEffect, useMemo, useState } from "react";
import { Button, Modal, ModalBody, Spinner } from "reactstrap";
import imagePlaceholder from "../../assets/images/users/user-dummy-img.jpg";
import { AudioCallContextValue } from "./types";

interface AudioCallOverlayProps extends AudioCallContextValue {}

const statusLabels = {
  calling: "Calling...",
  incoming: "Incoming audio call",
  connecting: "Connecting securely...",
  reconnecting: "Reconnecting...",
  active: "Connected",
  ended: "Call ended",
  failed: "Call could not be completed",
} as const;

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(
    2,
    "0",
  )}`;
};

const AudioCallOverlay = ({
  call,
  startCall: _startCall,
  acceptCall,
  rejectCall,
  endCall,
  toggleMute,
  dismissCall,
}: AudioCallOverlayProps) => {
  const [durationSeconds, setDurationSeconds] = useState(0);

  useEffect(() => {
    if (call?.status !== "active" || !call.connectedAt) {
      setDurationSeconds(0);
      return;
    }

    const updateDuration = () => {
      setDurationSeconds(
        Math.max(0, Math.floor((Date.now() - call.connectedAt!) / 1000)),
      );
    };
    updateDuration();
    const interval = window.setInterval(updateDuration, 1000);
    return () => window.clearInterval(interval);
  }, [call?.connectedAt, call?.status]);

  const initials = useMemo(
    () =>
      String(call?.peer.displayName || "U")
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part.charAt(0))
        .join("")
        .toUpperCase(),
    [call?.peer.displayName],
  );

  if (!call) {
    return null;
  }

  const isIncoming = call.status === "incoming";
  const isWaiting =
    call.status === "calling" ||
    call.status === "connecting" ||
    call.status === "reconnecting";
  const isComplete = call.status === "ended" || call.status === "failed";

  return (
    <Modal
      isOpen
      centered
      backdrop="static"
      keyboard={false}
      className="audio-call-modal"
      contentClassName="border-0 shadow-lg"
      labelledBy="audio-call-title"
    >
      <ModalBody className="p-0">
        <div className="audio-call-surface text-center">
          <div className="audio-call-status" aria-live="polite">
            {isWaiting && <Spinner size="sm" className="me-2" />}
            <span>{call.statusMessage || statusLabels[call.status]}</span>
          </div>

          <div className="audio-call-avatar mx-auto" aria-hidden="true">
            {call.peer.profileImage ? (
              <img src={call.peer.profileImage} alt="" />
            ) : (
              <span>{initials || <img src={imagePlaceholder} alt="" />}</span>
            )}
          </div>

          <h2 id="audio-call-title" className="audio-call-name">
            {call.peer.displayName}
          </h2>
          <p className="audio-call-duration mb-0">
            {call.status === "active"
              ? formatDuration(durationSeconds)
              : call.direction === "incoming"
                ? "Wants to talk with you"
                : "Audio call"}
          </p>

          <div className="audio-call-actions">
            {isIncoming ? (
              <>
                <div>
                  <Button
                    type="button"
                    color="danger"
                    className="audio-call-action"
                    onClick={rejectCall}
                    aria-label="Decline audio call"
                    title="Decline"
                  >
                    <i className="mdi mdi-phone-hangup" aria-hidden="true"></i>
                  </Button>
                  <span>Decline</span>
                </div>
                <div>
                  <Button
                    type="button"
                    color="success"
                    className="audio-call-action"
                    onClick={() => void acceptCall()}
                    aria-label="Answer audio call"
                    title="Answer"
                  >
                    <i className="bx bxs-phone-call" aria-hidden="true"></i>
                  </Button>
                  <span>Answer</span>
                </div>
              </>
            ) : isComplete ? (
              <Button
                type="button"
                color="primary"
                onClick={dismissCall}
                className="px-4"
              >
                Close
              </Button>
            ) : (
              <>
                {call.status === "active" && (
                  <div>
                    <Button
                      type="button"
                      color={call.isMuted ? "warning" : "light"}
                      className="audio-call-action"
                      onClick={toggleMute}
                      aria-label={
                        call.isMuted ? "Unmute microphone" : "Mute microphone"
                      }
                      aria-pressed={call.isMuted}
                      title={call.isMuted ? "Unmute" : "Mute"}
                    >
                      <i
                        className={`bx ${
                          call.isMuted ? "bx-microphone-off" : "bx-microphone"
                        }`}
                        aria-hidden="true"
                      ></i>
                    </Button>
                    <span>{call.isMuted ? "Unmute" : "Mute"}</span>
                  </div>
                )}
                <div>
                  <Button
                    type="button"
                    color="danger"
                    className="audio-call-action"
                    onClick={endCall}
                    aria-label="End audio call"
                    title="End call"
                  >
                    <i className="mdi mdi-phone-hangup" aria-hidden="true"></i>
                  </Button>
                  <span>End</span>
                </div>
              </>
            )}
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
};

export default AudioCallOverlay;
