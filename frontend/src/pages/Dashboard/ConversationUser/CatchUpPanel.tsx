import React, { useEffect, useRef, useState } from "react";
import { Button, Spinner } from "reactstrap";
import {
  CatchUpMomentKind,
  CatchUpWindow,
  ConversationCatchUp,
  getConversationCatchUp,
} from "../../../api/catchUp";

interface CatchUpPanelProps {
  conversationId: string | number;
  onClose: () => void;
  onSelectMessage: (messageId: string | number) => void;
}

const windows: Array<{ value: CatchUpWindow; label: string }> = [
  { value: "2h", label: "2 hours" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
];

const momentLabels: Record<CatchUpMomentKind, string> = {
  decision: "Decision",
  action: "Action",
  highlight: "Highlight",
};

const CatchUpPanel = ({
  conversationId,
  onClose,
  onSelectMessage,
}: CatchUpPanelProps) => {
  const requestIdRef = useRef(0);
  const [timeWindow, setTimeWindow] = useState<CatchUpWindow>("2h");
  const [catchUp, setCatchUp] = useState<ConversationCatchUp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setTimeWindow("2h");
    setCatchUp(null);
    setError("");
  }, [conversationId]);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError("");

    getConversationCatchUp(conversationId, timeWindow)
      .then(result => {
        if (requestIdRef.current === requestId) {
          setCatchUp(result);
        }
      })
      .catch((requestError: any) => {
        if (requestIdRef.current === requestId) {
          setCatchUp(null);
          setError(String(requestError || "Catch-up could not be generated"));
        }
      })
      .finally(() => {
        if (requestIdRef.current === requestId) {
          setLoading(false);
        }
      });
  }, [conversationId, timeWindow]);

  const selectMessage = (messageId: string) => {
    onClose();
    window.setTimeout(() => onSelectMessage(messageId), 0);
  };

  return (
    <section className="catch-up-panel border-bottom" aria-label="Catch-up">
      <div className="catch-up-toolbar">
        <div className="catch-up-title">
          <i className="bx bx-history" aria-hidden="true"></i>
          <div>
            <strong>Catch-up</strong>
            <span>Recent activity</span>
          </div>
        </div>
        <div
          className="btn-group btn-group-sm catch-up-window-picker"
          role="group"
          aria-label="Catch-up time window"
        >
          {windows.map(option => (
            <Button
              key={option.value}
              type="button"
              color={timeWindow === option.value ? "primary" : "light"}
              aria-pressed={timeWindow === option.value}
              onClick={() => setTimeWindow(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          color="link"
          className="catch-up-close"
          aria-label="Close catch-up"
          title="Close catch-up"
          onClick={onClose}
        >
          <i className="bx bx-x" aria-hidden="true"></i>
        </Button>
      </div>

      {loading && (
        <div className="catch-up-status text-muted">
          <Spinner size="sm" aria-label="Generating catch-up" />
          <span>Reading recent activity...</span>
        </div>
      )}

      {!loading && error && (
        <div className="catch-up-status text-danger">
          <i className="bx bx-error-circle" aria-hidden="true"></i>
          <span>{error}</span>
        </div>
      )}

      {!loading && catchUp && (
        <div className="catch-up-content">
          <p className="catch-up-summary">{catchUp.summary}</p>

          <dl className="catch-up-stats">
            <div>
              <dt>Messages</dt>
              <dd>{catchUp.messageCount}</dd>
            </div>
            <div>
              <dt>Participants</dt>
              <dd>{catchUp.participantCount}</dd>
            </div>
            <div>
              <dt>Replies</dt>
              <dd>{catchUp.replyCount}</dd>
            </div>
            <div>
              <dt>Files</dt>
              <dd>{catchUp.attachmentCount}</dd>
            </div>
          </dl>

          <div className="catch-up-detail-grid">
            <section aria-labelledby="catch-up-topics-heading">
              <h3 id="catch-up-topics-heading">Main topics</h3>
              {catchUp.topics.length > 0 ? (
                <div className="catch-up-topics">
                  {catchUp.topics.map(topic => (
                    <span key={topic.label}>
                      {topic.label}
                      <small>{topic.count}</small>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="catch-up-empty">Not enough text for topics.</p>
              )}
            </section>

            <section aria-labelledby="catch-up-participants-heading">
              <h3 id="catch-up-participants-heading">Most active</h3>
              {catchUp.activeParticipants.length > 0 ? (
                <ul className="catch-up-participants">
                  {catchUp.activeParticipants.map(participant => (
                    <li key={participant.userId}>
                      <span>{participant.username}</span>
                      <strong>{participant.messageCount}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="catch-up-empty">No participant activity.</p>
              )}
            </section>
          </div>

          {catchUp.keyMoments.length > 0 && (
            <section
              className="catch-up-moments"
              aria-labelledby="catch-up-moments-heading"
            >
              <div className="catch-up-section-heading">
                <h3 id="catch-up-moments-heading">Key messages</h3>
                <span>Open in conversation</span>
              </div>
              <div className="catch-up-moment-list">
                {catchUp.keyMoments.map(moment => (
                  <button
                    type="button"
                    key={moment.messageId}
                    className={`catch-up-moment catch-up-moment-${moment.kind}`}
                    onClick={() => selectMessage(moment.messageId)}
                  >
                    <span className="catch-up-moment-meta">
                      <strong>{momentLabels[moment.kind]}</strong>
                      <span>{moment.senderUsername}</span>
                      <time dateTime={moment.createdAt}>
                        {new Date(moment.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </span>
                    <span className="catch-up-moment-copy">
                      {moment.preview}
                    </span>
                    <i className="bx bx-right-arrow-alt" aria-hidden="true"></i>
                  </button>
                ))}
              </div>
            </section>
          )}

          {catchUp.truncated && (
            <p className="catch-up-truncated">
              The latest {catchUp.analyzedMessageCount} messages were analyzed.
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default CatchUpPanel;
