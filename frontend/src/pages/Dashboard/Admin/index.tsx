import React, {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Badge,
  Button,
  Form,
  FormGroup,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
  Table,
} from "reactstrap";
import {
  AdminAuditList,
  AdminMessageAccessAudit,
  AdminMessageAccessReason,
  AdminMessageList,
  AdminMessageMetadata,
  AdminOverview,
  AdminRevealedAttachment,
  getAdminAttachmentBlob,
  getAdminMessageAccessAudits,
  getAdminMessages,
  getAdminOverview,
  revealAdminMessage,
} from "../../../api/adminMonitoring";
import {
  AdminModerationReport,
  AdminModerationReportList,
  getAdminModerationReports,
  MessageReportReason,
  MessageReportStatus,
  ModerationResolutionAction,
  resolveAdminModerationReport,
} from "../../../api/moderation";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../../../helpers/notifications";
import {
  AdminOverviewLiveDelta,
  getAdminOverviewLiveDelta,
} from "./overviewLive";

type AdminView = "overview" | "moderation" | "messages" | "audits";
type OverviewLiveStatus = "connecting" | "live" | "delayed";

const OVERVIEW_REFRESH_INTERVAL_MS = 5000;

const REASON_LABELS: Record<AdminMessageAccessReason, string> = {
  support_request: "Support request",
  abuse_investigation: "Abuse investigation",
  security_incident: "Security incident",
  system_test: "System test",
  other: "Other",
};

const REPORT_REASON_LABELS: Record<MessageReportReason, string> = {
  harassment: "Harassment",
  sexual_content: "Sexual content",
  violence_or_threat: "Violence or threat",
  spam: "Spam",
  impersonation: "Impersonation",
  other: "Other",
};

const RESOLUTION_LABELS: Record<ModerationResolutionAction, string> = {
  dismiss: "Dismiss report",
  delete_message: "Delete message",
  warn_user: "Warn user",
  suspend_user: "Suspend user",
};

const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "-";

const formatLiveDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));

const formatBytes = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const conversationLabel = (
  conversation: AdminMessageMetadata["conversation"],
) => {
  if (conversation.name) {
    return conversation.name;
  }
  if (conversation.type === "direct") {
    return (
      conversation.recipients.map(user => user.username).join(", ") || "Direct"
    );
  }
  return "Unnamed conversation";
};

const AdminPanel = () => {
  const [view, setView] = useState<AdminView>("overview");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [overviewDelta, setOverviewDelta] =
    useState<AdminOverviewLiveDelta | null>(null);
  const [overviewLiveStatus, setOverviewLiveStatus] =
    useState<OverviewLiveStatus>("connecting");
  const [messages, setMessages] = useState<AdminMessageList | null>(null);
  const [audits, setAudits] = useState<AdminAuditList | null>(null);
  const [moderationReports, setModerationReports] =
    useState<AdminModerationReportList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [conversationType, setConversationType] = useState("");
  const [attachmentFilter, setAttachmentFilter] = useState("");
  const [moderationStatus, setModerationStatus] =
    useState<MessageReportStatus>("pending");
  const [moderationReason, setModerationReason] = useState<
    MessageReportReason | ""
  >("");
  const [selectedReport, setSelectedReport] =
    useState<AdminModerationReport | null>(null);
  const [selectedMessage, setSelectedMessage] =
    useState<AdminMessageMetadata | null>(null);
  const [reason, setReason] =
    useState<AdminMessageAccessReason>("support_request");
  const [justification, setJustification] = useState("");
  const [revealedContent, setRevealedContent] = useState<string | null>(null);
  const [revealedAuditId, setRevealedAuditId] = useState<string | null>(null);
  const [revealedAttachments, setRevealedAttachments] = useState<
    AdminRevealedAttachment[]
  >([]);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>(
    {},
  );
  const [visibleAttachmentIds, setVisibleAttachmentIds] = useState<Set<string>>(
    new Set(),
  );
  const [attachmentLoadingId, setAttachmentLoadingId] = useState<string | null>(
    null,
  );
  const createdObjectUrls = useRef<string[]>([]);
  const [revealing, setRevealing] = useState(false);
  const [resolutionAction, setResolutionAction] =
    useState<ModerationResolutionAction>("dismiss");
  const [resolutionNote, setResolutionNote] = useState("");
  const [suspensionHours, setSuspensionHours] = useState(24);
  const [resolving, setResolving] = useState(false);
  const previousOverviewRef = useRef<AdminOverview | null>(null);
  const overviewRequestInFlight = useRef(false);

  const loadOverview = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (overviewRequestInFlight.current) {
        return;
      }

      overviewRequestInFlight.current = true;
      if (!silent) {
        setLoading(true);
        setError("");
      }

      try {
        const nextOverview = await getAdminOverview();
        setOverviewDelta(
          getAdminOverviewLiveDelta(nextOverview, previousOverviewRef.current),
        );
        previousOverviewRef.current = nextOverview;
        setOverview(nextOverview);
        setOverviewLiveStatus("live");
      } catch (requestError) {
        setOverviewLiveStatus("delayed");
        if (!silent) {
          setError(String(requestError));
        }
      } finally {
        overviewRequestInFlight.current = false;
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (view !== "overview") {
      return;
    }

    const refreshVisibleOverview = () => {
      if (document.visibilityState === "visible") {
        void loadOverview({ silent: true });
      }
    };
    const intervalId = window.setInterval(
      refreshVisibleOverview,
      OVERVIEW_REFRESH_INTERVAL_MS,
    );
    document.addEventListener("visibilitychange", refreshVisibleOverview);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshVisibleOverview);
    };
  }, [loadOverview, view]);

  const loadMessages = useCallback(
    async (offset = 0) => {
      setLoading(true);
      setError("");
      try {
        setMessages(
          await getAdminMessages({
            search: search.trim() || undefined,
            conversationType: conversationType || undefined,
            hasAttachments:
              attachmentFilter === "" ? undefined : attachmentFilter === "yes",
            limit: 25,
            offset,
          }),
        );
      } catch (requestError) {
        setError(String(requestError));
      } finally {
        setLoading(false);
      }
    },
    [attachmentFilter, conversationType, search],
  );

  const loadAudits = useCallback(async (offset = 0) => {
    setLoading(true);
    setError("");
    try {
      setAudits(
        await getAdminMessageAccessAudits({
          limit: 25,
          offset,
        }),
      );
    } catch (requestError) {
      setError(String(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadModerationReports = useCallback(
    async (offset = 0) => {
      setLoading(true);
      setError("");
      try {
        setModerationReports(
          await getAdminModerationReports({
            status: moderationStatus || undefined,
            reason: moderationReason || undefined,
            limit: 25,
            offset,
          }),
        );
      } catch (requestError) {
        setError(String(requestError));
      } finally {
        setLoading(false);
      }
    },
    [moderationReason, moderationStatus],
  );

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(
    () => () => {
      createdObjectUrls.current.forEach(url => URL.revokeObjectURL(url));
    },
    [],
  );

  const changeView = (nextView: AdminView) => {
    setView(nextView);
    if (nextView === "overview") {
      void loadOverview();
    } else if (nextView === "moderation") {
      void loadModerationReports();
    } else if (nextView === "messages") {
      void loadMessages();
    } else {
      void loadAudits();
    }
  };

  const refresh = () => {
    if (view === "overview") {
      void loadOverview();
    } else if (view === "moderation") {
      void loadModerationReports(moderationReports?.pageInfo.offset ?? 0);
    } else if (view === "messages") {
      void loadMessages(messages?.pageInfo.offset ?? 0);
    } else {
      void loadAudits(audits?.pageInfo.offset ?? 0);
    }
  };

  const submitFilters = (event: FormEvent) => {
    event.preventDefault();
    void loadMessages(0);
  };

  const closeReveal = () => {
    createdObjectUrls.current.forEach(url => URL.revokeObjectURL(url));
    createdObjectUrls.current = [];
    setSelectedMessage(null);
    setSelectedReport(null);
    setReason("support_request");
    setJustification("");
    setRevealedContent(null);
    setRevealedAuditId(null);
    setRevealedAttachments([]);
    setAttachmentUrls({});
    setVisibleAttachmentIds(new Set());
    setAttachmentLoadingId(null);
    setRevealing(false);
    setResolutionAction("dismiss");
    setResolutionNote("");
    setSuspensionHours(24);
    setResolving(false);
  };

  const openModerationReview = (report: AdminModerationReport) => {
    setSelectedReport(report);
    setSelectedMessage(report.message);
    setReason("abuse_investigation");
    setJustification("");
    setResolutionAction("dismiss");
    setResolutionNote("");
    setSuspensionHours(24);
  };

  const loadAttachmentUrl = async (attachment: AdminRevealedAttachment) => {
    const existingUrl = attachmentUrls[attachment.id];
    if (existingUrl) {
      return existingUrl;
    }
    if (!selectedMessage || !revealedAuditId) {
      throw new Error("Audited attachment access is not ready");
    }

    const blob = await getAdminAttachmentBlob(
      selectedMessage.id,
      attachment.id,
      revealedAuditId,
    );
    const objectUrl = URL.createObjectURL(blob);
    createdObjectUrls.current.push(objectUrl);
    setAttachmentUrls(current => ({
      ...current,
      [attachment.id]: objectUrl,
    }));
    return objectUrl;
  };

  const showAttachment = async (attachment: AdminRevealedAttachment) => {
    setAttachmentLoadingId(attachment.id);
    try {
      await loadAttachmentUrl(attachment);
      setVisibleAttachmentIds(current => {
        const next = new Set(current);
        next.add(attachment.id);
        return next;
      });
    } catch (requestError) {
      showErrorNotification(String(requestError));
    } finally {
      setAttachmentLoadingId(null);
    }
  };

  const downloadAttachment = async (attachment: AdminRevealedAttachment) => {
    setAttachmentLoadingId(attachment.id);
    try {
      const objectUrl = await loadAttachmentUrl(attachment);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = attachment.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (requestError) {
      showErrorNotification(String(requestError));
    } finally {
      setAttachmentLoadingId(null);
    }
  };

  const submitReveal = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedMessage || justification.trim().length < 5) {
      return;
    }

    setRevealing(true);
    try {
      const result = await revealAdminMessage(selectedMessage.id, {
        reason,
        justification: justification.trim(),
      });
      setRevealedContent(result.content);
      setRevealedAuditId(result.auditId);
      setRevealedAttachments(result.attachments);
      showSuccessNotification("Message access recorded");
      void loadAudits(0);
      void loadOverview();
    } catch (requestError) {
      showErrorNotification(String(requestError));
    } finally {
      setRevealing(false);
    }
  };

  const submitResolution = async () => {
    if (
      !selectedReport ||
      !revealedAuditId ||
      resolutionNote.trim().length < 5
    ) {
      return;
    }

    setResolving(true);
    try {
      await resolveAdminModerationReport(selectedReport.id, {
        action: resolutionAction,
        note: resolutionNote.trim(),
        evidenceAuditId: revealedAuditId,
        suspensionHours:
          resolutionAction === "suspend_user" ? suspensionHours : undefined,
      });
      showSuccessNotification("Moderation decision recorded");
      closeReveal();
      void loadModerationReports(0);
      void loadOverview();
    } catch (requestError) {
      showErrorNotification(String(requestError));
      setResolving(false);
    }
  };

  const hasValidSuspension =
    resolutionAction !== "suspend_user" ||
    (suspensionHours >= 1 && suspensionHours <= 720);
  const resolutionReady =
    !resolving && resolutionNote.trim().length >= 5 && hasValidSuspension;
  const resolutionButtonLabel = resolving
    ? "Recording..."
    : resolutionNote.trim().length < 5
      ? "Add decision note"
      : !hasValidSuspension
        ? "Check suspension duration"
        : "Record decision";

  return (
    <main className="admin-monitoring-panel" aria-label="Admin Control Center">
      <header className="admin-monitoring-header">
        <div>
          <p className="admin-monitoring-eyebrow">ellO operations</p>
          <h1>Admin Control Center</h1>
          <p>System activity, message metadata and accountable access.</p>
        </div>
        <Button
          color="light"
          className="admin-refresh-button"
          onClick={refresh}
          disabled={loading}
          aria-label="Refresh admin data"
          title="Refresh admin data"
        >
          <i className={`bx bx-refresh ${loading ? "bx-spin" : ""}`} />
        </Button>
      </header>

      <nav className="admin-monitoring-tabs" aria-label="Admin panel sections">
        {(["overview", "moderation", "messages", "audits"] as AdminView[]).map(
          tab => (
            <button
              type="button"
              key={tab}
              className={view === tab ? "active" : ""}
              onClick={() => changeView(tab)}
            >
              {tab === "overview"
                ? "Overview"
                : tab === "moderation"
                  ? "Moderation"
                  : tab === "messages"
                    ? "Message audit"
                    : "Access log"}
            </button>
          ),
        )}
      </nav>

      <div className="admin-monitoring-content">
        {error && <Alert color="danger">{error}</Alert>}
        {loading && !overview && (
          <div className="admin-loading-state">
            <Spinner size="sm" />
            <span>Loading operational data...</span>
          </div>
        )}

        {view === "overview" && overview && (
          <OverviewView
            overview={overview}
            liveDelta={overviewDelta}
            liveStatus={overviewLiveStatus}
          />
        )}

        {view === "messages" && (
          <section aria-labelledby="message-audit-title">
            <div className="admin-section-heading">
              <div>
                <h2 id="message-audit-title">Message audit</h2>
                <p>
                  Content is excluded from this list and requires a recorded
                  reason to reveal.
                </p>
              </div>
              <Badge color="warning" pill>
                Content masked
              </Badge>
            </div>

            <Form className="admin-filter-bar" onSubmit={submitFilters}>
              <FormGroup>
                <Label for="admin-message-search">Sender or conversation</Label>
                <Input
                  id="admin-message-search"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search metadata"
                />
              </FormGroup>
              <FormGroup>
                <Label for="admin-conversation-type">Conversation type</Label>
                <Input
                  id="admin-conversation-type"
                  type="select"
                  value={conversationType}
                  onChange={event => setConversationType(event.target.value)}
                >
                  <option value="">All types</option>
                  <option value="direct">Direct</option>
                  <option value="group">Group</option>
                  <option value="management">Management</option>
                </Input>
              </FormGroup>
              <FormGroup>
                <Label for="admin-attachment-filter">Attachments</Label>
                <Input
                  id="admin-attachment-filter"
                  type="select"
                  value={attachmentFilter}
                  onChange={event => setAttachmentFilter(event.target.value)}
                >
                  <option value="">All messages</option>
                  <option value="yes">With attachments</option>
                  <option value="no">Without attachments</option>
                </Input>
              </FormGroup>
              <Button color="primary" type="submit" disabled={loading}>
                Apply filters
              </Button>
            </Form>

            <MessageTable
              data={messages}
              loading={loading}
              onReveal={setSelectedMessage}
              onPage={offset => void loadMessages(offset)}
            />
          </section>
        )}

        {view === "moderation" && (
          <ModerationQueue
            data={moderationReports}
            loading={loading}
            status={moderationStatus}
            reason={moderationReason}
            onStatusChange={setModerationStatus}
            onReasonChange={setModerationReason}
            onApply={() => void loadModerationReports(0)}
            onReview={openModerationReview}
            onPage={offset => void loadModerationReports(offset)}
          />
        )}

        {view === "audits" && (
          <AuditView
            data={audits}
            loading={loading}
            onPage={offset => void loadAudits(offset)}
          />
        )}
      </div>

      <Modal isOpen={Boolean(selectedMessage)} toggle={closeReveal} centered>
        <Form onSubmit={submitReveal}>
          <ModalHeader toggle={closeReveal}>
            {selectedReport
              ? "Review moderation report"
              : "Reveal message content"}
          </ModalHeader>
          <ModalBody>
            {revealedContent === null ? (
              <>
                {selectedReport && <ReportContext report={selectedReport} />}
                <Alert color="warning">
                  This action is permanent in the access log. Use a
                  case-specific justification.
                </Alert>
                <FormGroup>
                  <Label for="message-access-reason">Reason</Label>
                  <Input
                    id="message-access-reason"
                    type="select"
                    value={reason}
                    onChange={event =>
                      setReason(event.target.value as AdminMessageAccessReason)
                    }
                  >
                    {Object.entries(REASON_LABELS).map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </Input>
                </FormGroup>
                <FormGroup>
                  <Label for="message-access-justification">
                    Justification
                  </Label>
                  <Input
                    id="message-access-justification"
                    type="textarea"
                    rows={4}
                    maxLength={500}
                    value={justification}
                    onChange={event => setJustification(event.target.value)}
                    placeholder="Reference the ticket, incident or approved test."
                    required
                  />
                  <small>{justification.trim().length}/500 characters</small>
                </FormGroup>
              </>
            ) : (
              <>
                <div className="admin-revealed-content">
                  <span>Revealed content</span>
                  <p>
                    {revealedContent ||
                      "No text content. This message contains attachments only."}
                  </p>
                </div>
                <RevealedAttachments
                  attachments={revealedAttachments}
                  attachmentUrls={attachmentUrls}
                  visibleAttachmentIds={visibleAttachmentIds}
                  loadingId={attachmentLoadingId}
                  onShow={attachment => void showAttachment(attachment)}
                  onDownload={attachment => void downloadAttachment(attachment)}
                />
                {selectedReport && (
                  <div className="admin-resolution-form">
                    <h6>Moderation decision</h6>
                    <FormGroup>
                      <Label for="moderation-resolution-action">Action</Label>
                      <Input
                        id="moderation-resolution-action"
                        type="select"
                        value={resolutionAction}
                        disabled={resolving}
                        onChange={event =>
                          setResolutionAction(
                            event.target.value as ModerationResolutionAction,
                          )
                        }
                      >
                        {Object.entries(RESOLUTION_LABELS).map(
                          ([value, label]) => {
                            const protectsAccount =
                              selectedReport.reportedUser?.role === "admin" ||
                              selectedReport.reportedUser?.isBot;
                            const protectedAction = [
                              "warn_user",
                              "suspend_user",
                            ].includes(value);
                            return (
                              <option
                                value={value}
                                key={value}
                                disabled={protectsAccount && protectedAction}
                              >
                                {label}
                              </option>
                            );
                          },
                        )}
                      </Input>
                    </FormGroup>
                    {resolutionAction === "suspend_user" && (
                      <FormGroup>
                        <Label for="moderation-suspension-hours">
                          Suspension duration
                        </Label>
                        <Input
                          id="moderation-suspension-hours"
                          type="number"
                          min={1}
                          max={720}
                          value={suspensionHours}
                          disabled={resolving}
                          onChange={event =>
                            setSuspensionHours(Number(event.target.value))
                          }
                        />
                        <small>Hours, from 1 to 720.</small>
                      </FormGroup>
                    )}
                    <FormGroup className="mb-0">
                      <Label for="moderation-resolution-note">
                        Decision note
                      </Label>
                      <Input
                        id="moderation-resolution-note"
                        type="textarea"
                        rows={3}
                        maxLength={500}
                        value={resolutionNote}
                        disabled={resolving}
                        placeholder="Explain the evidence and decision."
                        onChange={event =>
                          setResolutionNote(event.target.value)
                        }
                      />
                      <small>
                        {resolutionNote.trim().length}/500 characters
                      </small>
                    </FormGroup>
                  </div>
                )}
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              color="secondary"
              outline
              type="button"
              onClick={closeReveal}
            >
              Close
            </Button>
            {revealedContent === null && (
              <Button
                color="danger"
                type="submit"
                disabled={revealing || justification.trim().length < 5}
              >
                {revealing ? <Spinner size="sm" /> : "Record and reveal"}
              </Button>
            )}
            {revealedContent !== null && selectedReport && (
              <Button
                color="success"
                className={`admin-record-decision-button ${
                  resolutionReady ? "is-ready" : "is-blocked"
                }`}
                type="button"
                disabled={!resolutionReady}
                onClick={() => void submitResolution()}
              >
                {resolving && <Spinner size="sm" className="me-2" />}
                {resolutionButtonLabel}
              </Button>
            )}
          </ModalFooter>
        </Form>
      </Modal>
    </main>
  );
};

const RevealedAttachments = ({
  attachments,
  attachmentUrls,
  visibleAttachmentIds,
  loadingId,
  onShow,
  onDownload,
}: {
  attachments: AdminRevealedAttachment[];
  attachmentUrls: Record<string, string>;
  visibleAttachmentIds: Set<string>;
  loadingId: string | null;
  onShow: (attachment: AdminRevealedAttachment) => void;
  onDownload: (attachment: AdminRevealedAttachment) => void;
}) => {
  if (!attachments.length) {
    return null;
  }

  return (
    <section
      className="admin-revealed-attachments"
      aria-labelledby="revealed-attachments-title"
    >
      <div className="admin-revealed-attachments-heading">
        <div>
          <h6 id="revealed-attachments-title">Attachments</h6>
          <p>Sensitive media stays covered until you choose to display it.</p>
        </div>
        <Badge color="danger" pill>
          {attachments.length} file{attachments.length === 1 ? "" : "s"}
        </Badge>
      </div>
      <div className="admin-revealed-attachment-list">
        {attachments.map(attachment => {
          const isImage = attachment.mimeType.startsWith("image/");
          const isAudio = attachment.mimeType.startsWith("audio/");
          const isVisible = visibleAttachmentIds.has(attachment.id);
          const objectUrl = attachmentUrls[attachment.id];
          const isLoading = loadingId === attachment.id;

          return (
            <article className="admin-revealed-attachment" key={attachment.id}>
              <div className="admin-attachment-meta">
                <i
                  className={
                    isImage
                      ? "bx bx-image"
                      : isAudio
                        ? "bx bx-headphone"
                        : "bx bx-file"
                  }
                />
                <div>
                  <strong>{attachment.fileName}</strong>
                  <span>
                    {attachment.mimeType} · {formatBytes(attachment.fileSize)}
                  </span>
                </div>
                <Button
                  color="light"
                  size="sm"
                  disabled={isLoading}
                  onClick={() => onDownload(attachment)}
                  aria-label={`Download ${attachment.fileName}`}
                  title={`Download ${attachment.fileName}`}
                >
                  <i className="bx bx-download" />
                </Button>
              </div>

              {(isImage || isAudio) && !isVisible && (
                <button
                  type="button"
                  className="admin-sensitive-media-cover"
                  disabled={isLoading}
                  onClick={() => onShow(attachment)}
                >
                  {isLoading ? (
                    <Spinner size="sm" />
                  ) : (
                    <i className="bx bx-low-vision" />
                  )}
                  <span>{isImage ? "Show image" : "Load audio"}</span>
                  <small>Potentially sensitive media</small>
                </button>
              )}

              {isImage && isVisible && objectUrl && (
                <img
                  src={objectUrl}
                  alt={`Audited attachment ${attachment.fileName}`}
                  className="admin-attachment-preview"
                />
              )}

              {isAudio && isVisible && objectUrl && (
                <audio
                  controls
                  src={objectUrl}
                  className="admin-attachment-audio"
                >
                  Your browser does not support audio playback.
                </audio>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};

const ModerationQueue = ({
  data,
  loading,
  status,
  reason,
  onStatusChange,
  onReasonChange,
  onApply,
  onReview,
  onPage,
}: {
  data: AdminModerationReportList | null;
  loading: boolean;
  status: MessageReportStatus;
  reason: MessageReportReason | "";
  onStatusChange: (status: MessageReportStatus) => void;
  onReasonChange: (reason: MessageReportReason | "") => void;
  onApply: () => void;
  onReview: (report: AdminModerationReport) => void;
  onPage: (offset: number) => void;
}) => (
  <section aria-labelledby="moderation-queue-title">
    <div className="admin-section-heading">
      <div>
        <h2 id="moderation-queue-title">Moderation queue</h2>
        <p>
          User reports are metadata-only until an administrator records an
          evidence access reason.
        </p>
      </div>
      <Badge color={status === "pending" ? "danger" : "secondary"} pill>
        {data?.pageInfo.total ?? 0} {status}
      </Badge>
    </div>

    <div className="admin-filter-bar admin-moderation-filter-bar">
      <FormGroup>
        <Label for="moderation-status-filter">Status</Label>
        <Input
          id="moderation-status-filter"
          type="select"
          value={status}
          onChange={event =>
            onStatusChange(event.target.value as MessageReportStatus)
          }
        >
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </Input>
      </FormGroup>
      <FormGroup>
        <Label for="moderation-reason-filter">Reason</Label>
        <Input
          id="moderation-reason-filter"
          type="select"
          value={reason}
          onChange={event =>
            onReasonChange(event.target.value as MessageReportReason | "")
          }
        >
          <option value="">All reasons</option>
          {Object.entries(REPORT_REASON_LABELS).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </Input>
      </FormGroup>
      <Button color="primary" disabled={loading} onClick={onApply}>
        Apply filters
      </Button>
    </div>

    <div className="admin-table-region">
      <Table responsive hover className="admin-monitoring-table">
        <thead>
          <tr>
            <th>Reported</th>
            <th>Reporter</th>
            <th>Conversation</th>
            <th>Reason</th>
            <th>Account history</th>
            <th>Status</th>
            <th>
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {!loading && data?.items.length === 0 && (
            <tr>
              <td colSpan={7} className="admin-empty-cell">
                No reports match these filters.
              </td>
            </tr>
          )}
          {data?.items.map(report => (
            <tr key={report.id}>
              <td>
                <strong>
                  {report.reportedUser?.username || "Former user"}
                </strong>
                <small>{formatDate(report.createdAt)}</small>
              </td>
              <td>
                <strong>{report.reporter?.username || "Former user"}</strong>
                <small>{report.reporter?.email || report.reporterId}</small>
              </td>
              <td>
                <strong>
                  {conversationLabel(report.message.conversation)}
                </strong>
                <small>{report.message.conversation.type}</small>
              </td>
              <td>
                <Badge color="warning">
                  {REPORT_REASON_LABELS[report.reason]}
                </Badge>
              </td>
              <td>
                <strong>
                  {report.reportedUser?.warningCount ?? 0} warning
                  {(report.reportedUser?.warningCount ?? 0) === 1 ? "" : "s"}
                </strong>
                <small>
                  {report.reportedUser?.suspendedUntil
                    ? `Suspended until ${formatDate(
                        report.reportedUser.suspendedUntil,
                      )}`
                    : "Not suspended"}
                </small>
              </td>
              <td>
                <Badge
                  color={
                    report.status === "pending"
                      ? "danger"
                      : report.status === "resolved"
                        ? "success"
                        : "secondary"
                  }
                >
                  {report.status}
                </Badge>
                {report.resolutionAction && (
                  <small>{RESOLUTION_LABELS[report.resolutionAction]}</small>
                )}
              </td>
              <td>
                {report.status === "pending" ? (
                  <Button
                    color="danger"
                    outline
                    size="sm"
                    onClick={() => onReview(report)}
                  >
                    Review
                  </Button>
                ) : (
                  <span className="text-muted font-size-11">
                    {report.reviewedByAdmin?.username || "Reviewed"}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <PaginationControls
        pageInfo={data?.pageInfo}
        loading={loading}
        onPage={onPage}
      />
    </div>
  </section>
);

const ReportContext = ({ report }: { report: AdminModerationReport }) => (
  <div className="admin-report-context">
    <div>
      <span>Report reason</span>
      <strong>{REPORT_REASON_LABELS[report.reason]}</strong>
    </div>
    <div>
      <span>Reporter</span>
      <strong>{report.reporter?.username || "Former user"}</strong>
    </div>
    <div>
      <span>Reported user</span>
      <strong>{report.reportedUser?.username || "Former user"}</strong>
    </div>
    <p>
      {report.details || "The reporter did not provide additional details."}
    </p>
  </div>
);

const OverviewView = ({
  overview,
  liveDelta,
  liveStatus,
}: {
  overview: AdminOverview;
  liveDelta: AdminOverviewLiveDelta | null;
  liveStatus: OverviewLiveStatus;
}) => {
  const stats = [
    ["Users", overview.totals.users],
    ["Conversations", overview.totals.conversations],
    ["Messages", overview.totals.messages],
    ["Stored files", overview.totals.attachments],
    ["Stored data", formatBytes(overview.totals.attachmentBytes)],
    ["Active sockets", overview.runtime.gauges.activeSockets],
    ["Open tickets", overview.totals.openSupportTickets],
    ["Content accesses", overview.totals.messageContentAccesses],
  ];
  const liveMetrics = [
    ["HTTP requests", formatLiveChange(liveDelta?.httpRequests)],
    ["Socket events", formatLiveChange(liveDelta?.socketEvents)],
    ["Messages created", formatLiveChange(liveDelta?.messagesCreated)],
    ["Active sockets", liveDelta?.activeSockets ?? 0],
  ];
  const liveStatusLabel =
    liveStatus === "live"
      ? "Live"
      : liveStatus === "delayed"
        ? "Update delayed"
        : "Connecting";

  return (
    <section aria-labelledby="operations-overview-title">
      <div className="admin-section-heading">
        <div>
          <h2 id="operations-overview-title">Operations overview</h2>
          <p>Current stored totals and process activity since server start.</p>
        </div>
        <div className="admin-overview-status">
          <span className={`admin-live-status is-${liveStatus}`} role="status">
            <span aria-hidden="true" />
            {liveStatusLabel}
          </span>
          <span className="admin-collected-at">
            Updated {formatLiveDate(overview.collectedAt)}
          </span>
        </div>
      </div>

      <div className="admin-stat-grid">
        {stats.map(([label, value]) => (
          <div className="admin-stat-tile" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <section
        className="admin-live-activity"
        aria-labelledby="live-data-title"
      >
        <div>
          <h3 id="live-data-title">Live activity</h3>
          <p>Changes recorded during the latest 5-second refresh.</p>
        </div>
        <dl aria-live="polite">
          {liveMetrics.map(([label, value]) => (
            <Metric label={String(label)} value={value} key={label} />
          ))}
        </dl>
      </section>

      <div className="admin-overview-bands">
        <section>
          <h3>Last 24 hours</h3>
          <dl>
            <Metric label="New users" value={overview.activity24h.newUsers} />
            <Metric
              label="New conversations"
              value={overview.activity24h.newConversations}
            />
            <Metric label="Messages" value={overview.activity24h.messages} />
            <Metric
              label="Attachments"
              value={overview.activity24h.attachments}
            />
            <Metric label="Calls" value={overview.activity24h.calls} />
            <Metric
              label="Content accesses"
              value={overview.activity24h.messageContentAccesses}
            />
          </dl>
        </section>
        <section>
          <h3>Runtime traffic</h3>
          <dl>
            <Metric
              label="HTTP requests"
              value={overview.runtime.counters.httpRequestsTotal}
            />
            <Metric
              label="HTTP errors"
              value={overview.runtime.counters.httpErrorsTotal}
            />
            <Metric
              label="Socket events"
              value={overview.runtime.counters.socketEventsTotal}
            />
            <Metric
              label="Socket errors"
              value={overview.runtime.counters.socketErrorsTotal}
            />
            <Metric
              label="Average response"
              value={`${overview.runtime.gauges.averageHttpDurationMs} ms`}
            />
            <Metric
              label="Uptime"
              value={`${Math.floor(overview.runtime.uptimeSeconds / 60)} min`}
            />
          </dl>
        </section>
        <section>
          <h3>Conversation mix</h3>
          <dl>
            <Metric
              label="Direct"
              value={overview.totals.directConversations}
            />
            <Metric label="Groups" value={overview.totals.groupConversations} />
            <Metric
              label="Management"
              value={overview.totals.managementConversations}
            />
            <Metric
              label="Automation groups"
              value={overview.totals.botManagedGroups}
            />
            <Metric label="Calls" value={overview.totals.calls} />
            <Metric
              label="Deleted messages"
              value={overview.totals.deletedMessages}
            />
          </dl>
        </section>
      </div>
    </section>
  );
};

const formatLiveChange = (value: number | null | undefined) =>
  value === null || value === undefined ? "-" : `+${value}`;

const Metric = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <div>
    <dt>{label}</dt>
    <dd>{value}</dd>
  </div>
);

const MessageTable = ({
  data,
  loading,
  onReveal,
  onPage,
}: {
  data: AdminMessageList | null;
  loading: boolean;
  onReveal: (message: AdminMessageMetadata) => void;
  onPage: (offset: number) => void;
}) => (
  <div className="admin-table-region">
    <Table responsive hover className="admin-monitoring-table">
      <thead>
        <tr>
          <th>Sent</th>
          <th>Sender</th>
          <th>Conversation</th>
          <th>Type</th>
          <th>Files</th>
          <th>Content</th>
          <th>
            <span className="visually-hidden">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {!loading && data?.items.length === 0 && (
          <tr>
            <td colSpan={7} className="admin-empty-cell">
              No message metadata matches these filters.
            </td>
          </tr>
        )}
        {data?.items.map(message => (
          <tr key={message.id}>
            <td>{formatDate(message.createdAt)}</td>
            <td>
              <strong>{message.sender?.username || "ellO system"}</strong>
              <small>{message.sender?.email || "System event"}</small>
            </td>
            <td>
              <strong>{conversationLabel(message.conversation)}</strong>
              <small>
                {message.conversation.type} ·{" "}
                {message.conversation.participantCount} participants
              </small>
            </td>
            <td>
              <Badge
                color={message.messageType === "system" ? "info" : "light"}
              >
                {message.messageType}
              </Badge>
            </td>
            <td>
              {message.attachmentCount
                ? `${message.attachmentCount} · ${formatBytes(
                    message.attachmentBytes,
                  )}`
                : "-"}
            </td>
            <td>
              <span className={`admin-content-state ${message.contentState}`}>
                <i
                  className={
                    message.contentState === "deleted"
                      ? "bx bx-trash"
                      : "bx bx-lock-alt"
                  }
                />
                {message.contentState}
              </span>
            </td>
            <td>
              <Button
                color="danger"
                outline
                size="sm"
                disabled={message.contentState === "deleted"}
                onClick={() => onReveal(message)}
              >
                Reveal
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
    <PaginationControls
      pageInfo={data?.pageInfo}
      loading={loading}
      onPage={onPage}
    />
  </div>
);

const AuditView = ({
  data,
  loading,
  onPage,
}: {
  data: AdminAuditList | null;
  loading: boolean;
  onPage: (offset: number) => void;
}) => (
  <section aria-labelledby="access-log-title">
    <div className="admin-section-heading">
      <div>
        <h2 id="access-log-title">Message access log</h2>
        <p>Every successful content reveal is listed with its justification.</p>
      </div>
    </div>
    <div className="admin-table-region">
      <Table responsive hover className="admin-monitoring-table">
        <thead>
          <tr>
            <th>Accessed</th>
            <th>Administrator</th>
            <th>Message context</th>
            <th>Reason</th>
            <th>Justification</th>
          </tr>
        </thead>
        <tbody>
          {!loading && data?.items.length === 0 && (
            <tr>
              <td colSpan={5} className="admin-empty-cell">
                No message content has been accessed.
              </td>
            </tr>
          )}
          {data?.items.map(audit => (
            <AuditRow audit={audit} key={audit.id} />
          ))}
        </tbody>
      </Table>
      <PaginationControls
        pageInfo={data?.pageInfo}
        loading={loading}
        onPage={onPage}
      />
    </div>
  </section>
);

const AuditRow = ({ audit }: { audit: AdminMessageAccessAudit }) => (
  <tr>
    <td>{formatDate(audit.createdAt)}</td>
    <td>
      <strong>{audit.admin?.username || "Former admin"}</strong>
      <small>{audit.admin?.email || audit.message.id}</small>
    </td>
    <td>
      <strong>
        {audit.message.conversation?.name ||
          audit.message.conversation?.type ||
          "Deleted conversation"}
      </strong>
      <small>{audit.message.sender?.username || "ellO system"}</small>
    </td>
    <td>
      <Badge color="secondary">{REASON_LABELS[audit.reason]}</Badge>
    </td>
    <td className="admin-justification-cell">{audit.justification}</td>
  </tr>
);

const PaginationControls = ({
  pageInfo,
  loading,
  onPage,
}: {
  pageInfo?: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  loading: boolean;
  onPage: (offset: number) => void;
}) => {
  if (!pageInfo) {
    return null;
  }
  const start = pageInfo.total === 0 ? 0 : pageInfo.offset + 1;
  const end = Math.min(pageInfo.offset + pageInfo.limit, pageInfo.total);

  return (
    <div className="admin-pagination">
      <span>
        {start}-{end} of {pageInfo.total}
      </span>
      <div>
        <Button
          color="light"
          size="sm"
          disabled={loading || pageInfo.offset === 0}
          onClick={() => onPage(Math.max(0, pageInfo.offset - pageInfo.limit))}
          aria-label="Previous page"
          title="Previous page"
        >
          <i className="bx bx-chevron-left" />
        </Button>
        <Button
          color="light"
          size="sm"
          disabled={loading || !pageInfo.hasMore}
          onClick={() => onPage(pageInfo.offset + pageInfo.limit)}
          aria-label="Next page"
          title="Next page"
        >
          <i className="bx bx-chevron-right" />
        </Button>
      </div>
    </div>
  );
};

export default AdminPanel;
