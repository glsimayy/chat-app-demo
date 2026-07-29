import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Spinner } from "reactstrap";
import { MessagesTypes } from "../../../data/messages";
import { searchConversationMessages } from "../../../api/chats";

interface MessageSearchPanelProps {
  conversationId: string | number;
  onClose: () => void;
  onSelectMessage: (messageId: string | number) => void;
}

const MessageSearchPanel = ({
  conversationId,
  onClose,
  onSelectMessage,
}: MessageSearchPanelProps) => {
  const { t, i18n } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MessagesTypes[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setQuery("");
    setResults([]);
    setError("");
  }, [conversationId]);

  useEffect(() => {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      requestIdRef.current += 1;
      setLoading(false);
      setResults([]);
      setError("");
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError("");
        const matches = await searchConversationMessages(
          conversationId,
          normalizedQuery,
        );

        if (requestIdRef.current === requestId) {
          setResults(matches);
        }
      } catch (searchError: any) {
        if (requestIdRef.current === requestId) {
          setResults([]);
          setError(String(searchError || t("chat.searchFailed")));
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [conversationId, query, t]);

  return (
    <section
      className="message-search-panel border-bottom"
      aria-label={t("chat.searchMessages")}
    >
      <div className="message-search-controls">
        <i className="bx bx-search" aria-hidden="true"></i>
        <Input
          innerRef={inputRef}
          value={query}
          maxLength={2000}
          placeholder={t("chat.searchConversation")}
          aria-label={t("chat.searchConversation")}
          onChange={event => setQuery(event.target.value)}
        />
        {loading && (
          <Spinner size="sm" aria-label={t("chat.searchingMessages")} />
        )}
        <Button
          type="button"
          color="link"
          className="message-search-close"
          aria-label={t("chat.closeMessageSearch")}
          title={t("chat.closeSearch")}
          onClick={onClose}
        >
          <i className="bx bx-x" aria-hidden="true"></i>
        </Button>
      </div>

      {error && <p className="message-search-status text-danger">{error}</p>}
      {!error && query.trim() && !loading && results.length === 0 && (
        <p className="message-search-status text-muted">
          {t("chat.noMessagesFound")}
        </p>
      )}
      {results.length > 0 && (
        <div className="message-search-results" role="list">
          {results.map(message => {
            const sender =
              message.meta.userData?.username ||
              (message.messageType === "system"
                ? t("chat.system")
                : t("chat.participant"));

            return (
              <button
                type="button"
                role="listitem"
                className="message-search-result"
                key={String(message.mId)}
                onClick={() => onSelectMessage(message.mId)}
              >
                <span className="message-search-result-meta">
                  <strong>{sender}</strong>
                  <time dateTime={message.time}>
                    {new Date(message.time).toLocaleString(
                      i18n.resolvedLanguage,
                    )}
                  </time>
                </span>
                <span className="message-search-result-copy">
                  {message.text || t("chat.attachment")}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default MessageSearchPanel;
