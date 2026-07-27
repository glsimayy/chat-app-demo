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

const formatBytes = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatState = (state: string) =>
  state ? `${state.charAt(0).toUpperCase()}${state.slice(1)}` : "Unknown";

const AudioCallOverlay = ({
  call,
  diagnostics,
  startCall: _startCall,
  acceptCall,
  rejectCall,
  endCall,
  toggleMute,
  dismissCall,
  refreshDiagnostics,
  resumeRemoteAudio,
}: AudioCallOverlayProps) => {
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

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

  useEffect(() => {
    setShowDiagnostics(false);
    setCopyStatus("idle");
  }, [call?.callId]);

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
  const microphoneStatus = !diagnostics?.localTrack.available
    ? "Unavailable"
    : diagnostics.localTrack.readyState === "ended"
      ? "Ended"
      : !diagnostics.localTrack.enabled
        ? "Muted"
        : diagnostics.outbound.bytes > 0
          ? `Sending (${formatBytes(diagnostics.outbound.bytes)})`
          : "No outgoing data";
  const remoteAudioStatus =
    diagnostics?.playbackState === "blocked"
      ? "Playback blocked"
      : !diagnostics?.remoteTrack.available
        ? "No remote track"
        : diagnostics.inbound.bytes > 0
          ? `Receiving (${formatBytes(diagnostics.inbound.bytes)})`
          : "No incoming data";
  const networkPath = diagnostics?.candidatePair
    ? [
        diagnostics.candidatePair.localCandidateType || "unknown",
        diagnostics.candidatePair.remoteCandidateType || "unknown",
        diagnostics.candidatePair.protocol || "unknown",
        diagnostics.candidatePair.relayProtocol,
      ]
        .filter(Boolean)
        .join(" / ")
    : "Waiting for candidate pair";

  const copyDiagnostics = async () => {
    if (!diagnostics || !navigator.clipboard) {
      setCopyStatus("failed");
      return;
    }

    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            origin: window.location.origin,
            secureContext: window.isSecureContext,
            userAgent: navigator.userAgent,
            call: {
              callId: call.callId,
              conversationId: call.conversationId,
              direction: call.direction,
              status: call.status,
            },
            diagnostics,
          },
          null,
          2,
        ),
      );
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

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
          <Button
            type="button"
            color="link"
            className="audio-call-diagnostics-toggle"
            onClick={() => {
              setShowDiagnostics(current => !current);
              void refreshDiagnostics();
            }}
            aria-label="Call diagnostics"
            aria-expanded={showDiagnostics}
            title="Call diagnostics"
          >
            <i className="bx bx-info-circle" aria-hidden="true"></i>
          </Button>

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

          {showDiagnostics && (
            <section
              className="audio-call-diagnostics text-start"
              aria-labelledby="audio-call-diagnostics-title"
            >
              <div className="audio-call-diagnostics-header">
                <h3 id="audio-call-diagnostics-title">Call diagnostics</h3>
                <div>
                  <Button
                    type="button"
                    color="link"
                    onClick={() => void refreshDiagnostics()}
                    aria-label="Refresh call diagnostics"
                    title="Refresh"
                  >
                    <i className="bx bx-refresh" aria-hidden="true"></i>
                  </Button>
                  <Button
                    type="button"
                    color="link"
                    onClick={() => void copyDiagnostics()}
                    aria-label="Copy call diagnostics"
                    title="Copy report"
                    disabled={!diagnostics}
                  >
                    <i className="bx bx-copy" aria-hidden="true"></i>
                  </Button>
                </div>
              </div>

              {diagnostics ? (
                <>
                  <p
                    className={`audio-call-diagnostics-summary is-${diagnostics.level}`}
                    aria-live="polite"
                  >
                    {diagnostics.summary}
                  </p>
                  <dl>
                    <div>
                      <dt>Connection</dt>
                      <dd data-testid="call-diagnostics-connection">
                        {formatState(diagnostics.connectionState)} /{" "}
                        {formatState(diagnostics.iceConnectionState)}
                      </dd>
                    </div>
                    <div>
                      <dt>Microphone</dt>
                      <dd data-testid="call-diagnostics-microphone">
                        {microphoneStatus}
                      </dd>
                    </div>
                    <div>
                      <dt>Remote audio</dt>
                      <dd data-testid="call-diagnostics-remote-audio">
                        {remoteAudioStatus}
                      </dd>
                    </div>
                    <div>
                      <dt>Network path</dt>
                      <dd data-testid="call-diagnostics-network">
                        {networkPath}
                      </dd>
                    </div>
                  </dl>
                  {diagnostics.playbackState === "blocked" && (
                    <Button
                      type="button"
                      color="primary"
                      size="sm"
                      className="audio-call-resume-button"
                      onClick={() => void resumeRemoteAudio()}
                    >
                      <i className="bx bx-play me-1" aria-hidden="true"></i>
                      Play remote audio
                    </Button>
                  )}
                  {copyStatus !== "idle" && (
                    <span
                      className={`audio-call-copy-status is-${copyStatus}`}
                      role="status"
                    >
                      {copyStatus === "copied"
                        ? "Report copied"
                        : "Report could not be copied"}
                    </span>
                  )}
                </>
              ) : (
                <p className="audio-call-diagnostics-empty mb-0">
                  Collecting connection data...
                </p>
              )}
            </section>
          )}

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
