import React, { useEffect, useMemo, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Button, Modal, ModalBody, Spinner } from "reactstrap";
import imagePlaceholder from "../../assets/images/users/user-dummy-img.jpg";
import { AudioCallContextValue } from "./types";

interface AudioCallOverlayProps extends AudioCallContextValue {}

const statusLabelKeys = {
  calling: "calls.status.calling",
  incoming: "calls.status.incoming",
  connecting: "calls.status.connecting",
  reconnecting: "calls.status.reconnecting",
  active: "calls.status.active",
  ended: "calls.status.ended",
  failed: "calls.status.failed",
} as const;

const diagnosticSummaryKeys: Record<string, string> = {
  "The network audio path failed.": "calls.summary.pathFailed",
  "The network audio path was interrupted.": "calls.summary.pathInterrupted",
  "Waiting for the peer audio connection.": "calls.summary.waitingPeer",
  "No local microphone track is available.": "calls.summary.noMicrophone",
  "The local microphone track ended.": "calls.summary.microphoneEnded",
  "The microphone is muted.": "calls.summary.microphoneMuted",
  "The browser blocked remote audio playback.": "calls.summary.browserBlocked",
  "Connected, but no outgoing audio data is visible yet.":
    "calls.summary.noOutgoing",
  "Connected, but no incoming audio data is visible yet.":
    "calls.summary.noIncoming",
  "Two-way audio data is flowing.": "calls.summary.flowing",
};

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

const formatState = (state: string, t: TFunction) =>
  state
    ? t(`calls.state.${state}`, { defaultValue: state })
    : t("calls.unknown");

const translateStatusMessage = (message: string | undefined, t: TFunction) => {
  if (!message) {
    return "";
  }
  const statusMessageKeys: Record<string, string> = {
    "Opening microphone...": "calls.openingMicrophone",
    "Connecting securely...": "calls.status.connecting",
    "Restoring audio connection...": "calls.restoringConnection",
    "Reconnecting to the call...": "calls.status.reconnecting",
  };
  return statusMessageKeys[message] ? t(statusMessageKeys[message]) : message;
};

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
  const { t } = useTranslation();
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
    ? t("calls.unavailable")
    : diagnostics.localTrack.readyState === "ended"
      ? t("calls.ended")
      : !diagnostics.localTrack.enabled
        ? t("calls.muted")
        : diagnostics.outbound.bytes > 0
          ? t("calls.sending", {
              size: formatBytes(diagnostics.outbound.bytes),
            })
          : t("calls.noOutgoingData");
  const remoteAudioStatus =
    diagnostics?.playbackState === "blocked"
      ? t("calls.playbackBlocked")
      : !diagnostics?.remoteTrack.available
        ? t("calls.noRemoteTrack")
        : diagnostics.inbound.bytes > 0
          ? t("calls.receiving", {
              size: formatBytes(diagnostics.inbound.bytes),
            })
          : t("calls.noIncomingData");
  const networkPath = diagnostics?.candidatePair
    ? [
        diagnostics.candidatePair.localCandidateType || "unknown",
        diagnostics.candidatePair.remoteCandidateType || "unknown",
        diagnostics.candidatePair.protocol || "unknown",
        diagnostics.candidatePair.relayProtocol,
      ]
        .filter(Boolean)
        .join(" / ")
    : t("calls.waitingCandidate");

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
            aria-label={t("calls.diagnostics")}
            aria-expanded={showDiagnostics}
            title={t("calls.diagnostics")}
          >
            <i className="bx bx-info-circle" aria-hidden="true"></i>
          </Button>

          <div className="audio-call-status" aria-live="polite">
            {isWaiting && <Spinner size="sm" className="me-2" />}
            <span>
              {translateStatusMessage(call.statusMessage, t) ||
                t(statusLabelKeys[call.status])}
            </span>
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
                ? t("calls.wantsToTalk")
                : t("calls.audioCall")}
          </p>

          {showDiagnostics && (
            <section
              className="audio-call-diagnostics text-start"
              aria-labelledby="audio-call-diagnostics-title"
            >
              <div className="audio-call-diagnostics-header">
                <h3 id="audio-call-diagnostics-title">
                  {t("calls.diagnostics")}
                </h3>
                <div>
                  <Button
                    type="button"
                    color="link"
                    onClick={() => void refreshDiagnostics()}
                    aria-label={t("calls.refreshDiagnostics")}
                    title={t("support.refresh")}
                  >
                    <i className="bx bx-refresh" aria-hidden="true"></i>
                  </Button>
                  <Button
                    type="button"
                    color="link"
                    onClick={() => void copyDiagnostics()}
                    aria-label={t("calls.copyDiagnostics")}
                    title={t("calls.copyReport")}
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
                    {diagnosticSummaryKeys[diagnostics.summary]
                      ? t(diagnosticSummaryKeys[diagnostics.summary])
                      : diagnostics.summary}
                  </p>
                  <dl>
                    <div>
                      <dt>{t("calls.connection")}</dt>
                      <dd data-testid="call-diagnostics-connection">
                        {formatState(diagnostics.connectionState, t)} /{" "}
                        {formatState(diagnostics.iceConnectionState, t)}
                      </dd>
                    </div>
                    <div>
                      <dt>{t("calls.microphone")}</dt>
                      <dd data-testid="call-diagnostics-microphone">
                        {microphoneStatus}
                      </dd>
                    </div>
                    <div>
                      <dt>{t("calls.remoteAudio")}</dt>
                      <dd data-testid="call-diagnostics-remote-audio">
                        {remoteAudioStatus}
                      </dd>
                    </div>
                    <div>
                      <dt>{t("calls.networkPath")}</dt>
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
                      {t("calls.playRemoteAudio")}
                    </Button>
                  )}
                  {copyStatus !== "idle" && (
                    <span
                      className={`audio-call-copy-status is-${copyStatus}`}
                      role="status"
                    >
                      {copyStatus === "copied"
                        ? t("calls.reportCopied")
                        : t("calls.reportCopyFailed")}
                    </span>
                  )}
                </>
              ) : (
                <p className="audio-call-diagnostics-empty mb-0">
                  {t("calls.collectingData")}
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
                    aria-label={t("calls.declineAria")}
                    title={t("calls.decline")}
                  >
                    <i className="mdi mdi-phone-hangup" aria-hidden="true"></i>
                  </Button>
                  <span>{t("calls.decline")}</span>
                </div>
                <div>
                  <Button
                    type="button"
                    color="success"
                    className="audio-call-action"
                    onClick={() => void acceptCall()}
                    aria-label={t("calls.answerAria")}
                    title={t("calls.answer")}
                  >
                    <i className="bx bxs-phone-call" aria-hidden="true"></i>
                  </Button>
                  <span>{t("calls.answer")}</span>
                </div>
              </>
            ) : isComplete ? (
              <Button
                type="button"
                color="primary"
                onClick={dismissCall}
                className="px-4"
              >
                {t("common.close")}
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
                        call.isMuted
                          ? t("calls.unmuteMicrophone")
                          : t("calls.muteMicrophone")
                      }
                      aria-pressed={call.isMuted}
                      title={t(call.isMuted ? "calls.unmute" : "calls.mute")}
                    >
                      <i
                        className={`bx ${
                          call.isMuted ? "bx-microphone-off" : "bx-microphone"
                        }`}
                        aria-hidden="true"
                      ></i>
                    </Button>
                    <span>
                      {t(call.isMuted ? "calls.unmute" : "calls.mute")}
                    </span>
                  </div>
                )}
                <div>
                  <Button
                    type="button"
                    color="danger"
                    className="audio-call-action"
                    onClick={endCall}
                    aria-label={t("calls.endCallAria")}
                    title={t("calls.endCall")}
                  >
                    <i className="mdi mdi-phone-hangup" aria-hidden="true"></i>
                  </Button>
                  <span>{t("calls.end")}</span>
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
