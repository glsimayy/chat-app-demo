import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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

const windows: Array<{ value: CatchUpWindow; labelKey: string }> = [
  { value: "2h", labelKey: "catchUp.twoHours" },
  { value: "24h", labelKey: "catchUp.twentyFourHours" },
  { value: "7d", labelKey: "catchUp.sevenDays" },
];

const momentLabelKeys: Record<CatchUpMomentKind, string> = {
  decision: "catchUp.decision",
  action: "catchUp.action",
  highlight: "catchUp.highlight",
};

const CatchUpPanel = ({
  conversationId,
  onClose,
  onSelectMessage,
}: CatchUpPanelProps) => {
  const { t, i18n } = useTranslation();
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
          setError(String(requestError || t("catchUp.generationFailed")));
        }
      })
      .finally(() => {
        if (requestIdRef.current === requestId) {
          setLoading(false);
        }
      });
  }, [conversationId, t, timeWindow]);

  const selectMessage = (messageId: string) => {
    onClose();
    window.setTimeout(() => onSelectMessage(messageId), 0);
  };

  return (
    <section
      className="catch-up-panel border-bottom"
      aria-label={t("catchUp.title")}
    >
      <div className="catch-up-toolbar">
        <div className="catch-up-title">
          <i className="bx bx-history" aria-hidden="true"></i>
          <div>
            <strong>{t("catchUp.title")}</strong>
            <span>{t("catchUp.recentActivity")}</span>
          </div>
        </div>
        <div
          className="btn-group btn-group-sm catch-up-window-picker"
          role="group"
          aria-label={t("catchUp.timeWindow")}
        >
          {windows.map(option => (
            <Button
              key={option.value}
              type="button"
              color={timeWindow === option.value ? "primary" : "light"}
              aria-pressed={timeWindow === option.value}
              onClick={() => setTimeWindow(option.value)}
            >
              {t(option.labelKey)}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          color="link"
          className="catch-up-close"
          aria-label={t("catchUp.close")}
          title={t("catchUp.close")}
          onClick={onClose}
        >
          <i className="bx bx-x" aria-hidden="true"></i>
        </Button>
      </div>

      {loading && (
        <div className="catch-up-status text-muted">
          <Spinner size="sm" aria-label={t("catchUp.generating")} />
          <span>{t("catchUp.reading")}</span>
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
              <dt>{t("catchUp.messages")}</dt>
              <dd>{catchUp.messageCount}</dd>
            </div>
            <div>
              <dt>{t("catchUp.participants")}</dt>
              <dd>{catchUp.participantCount}</dd>
            </div>
            <div>
              <dt>{t("catchUp.replies")}</dt>
              <dd>{catchUp.replyCount}</dd>
            </div>
            <div>
              <dt>{t("catchUp.files")}</dt>
              <dd>{catchUp.attachmentCount}</dd>
            </div>
          </dl>

          <div className="catch-up-detail-grid">
            <section aria-labelledby="catch-up-topics-heading">
              <h3 id="catch-up-topics-heading">{t("catchUp.mainTopics")}</h3>
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
                <p className="catch-up-empty">
                  {t("catchUp.insufficientTopics")}
                </p>
              )}
            </section>

            <section aria-labelledby="catch-up-participants-heading">
              <h3 id="catch-up-participants-heading">
                {t("catchUp.mostActive")}
              </h3>
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
                <p className="catch-up-empty">
                  {t("catchUp.noParticipantActivity")}
                </p>
              )}
            </section>
          </div>

          {catchUp.keyMoments.length > 0 && (
            <section
              className="catch-up-moments"
              aria-labelledby="catch-up-moments-heading"
            >
              <div className="catch-up-section-heading">
                <h3 id="catch-up-moments-heading">
                  {t("catchUp.keyMessages")}
                </h3>
                <span>{t("catchUp.openInConversation")}</span>
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
                      <strong>{t(momentLabelKeys[moment.kind])}</strong>
                      <span>{moment.senderUsername}</span>
                      <time dateTime={moment.createdAt}>
                        {new Date(moment.createdAt).toLocaleTimeString(
                          i18n.resolvedLanguage,
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
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
              {t("catchUp.truncated", {
                count: catchUp.analyzedMessageCount,
              })}
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default CatchUpPanel;
