import React, {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
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

const REASON_LABEL_KEYS: Record<AdminMessageAccessReason, string> = {
  support_request: "admin.accessReason.supportRequest",
  abuse_investigation: "admin.accessReason.abuseInvestigation",
  security_incident: "admin.accessReason.securityIncident",
  system_test: "admin.accessReason.systemTest",
  other: "admin.accessReason.other",
};

const REPORT_REASON_LABEL_KEYS: Record<MessageReportReason, string> = {
  harassment: "moderation.harassment",
  sexual_content: "moderation.sexualContent",
  violence_or_threat: "moderation.violenceOrThreat",
  spam: "moderation.spam",
  impersonation: "moderation.impersonation",
  other: "moderation.other",
};

const RESOLUTION_LABEL_KEYS: Record<ModerationResolutionAction, string> = {
  dismiss: "moderation.dismissReport",
  delete_message: "moderation.deleteMessage",
  warn_user: "moderation.warnUser",
  suspend_user: "moderation.suspendUser",
};

const formatDate = (value: string | null, locale?: string) =>
  value
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "-";

const formatLiveDate = (value: string, locale?: string) =>
  new Intl.DateTimeFormat(locale, {
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
  t: TFunction,
) => {
  if (conversation.name) {
    return conversation.name;
  }
  if (conversation.type === "direct") {
    return (
      conversation.recipients.map(user => user.username).join(", ") ||
      t("admin.direct")
    );
  }
  return t("admin.unnamedConversation");
};

const AdminPanel = () => {
  const { t } = useTranslation();
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
      showSuccessNotification(t("admin.accessRecorded"));
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
      showSuccessNotification(t("moderation.decisionRecorded"));
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
    ? t("moderation.recording")
    : resolutionNote.trim().length < 5
      ? t("moderation.addDecisionNote")
      : !hasValidSuspension
        ? t("moderation.checkSuspension")
        : t("moderation.recordDecision");

  return (
    <main className="admin-monitoring-panel" aria-label={t("admin.title")}>
      <header className="admin-monitoring-header">
        <div>
          <p className="admin-monitoring-eyebrow">{t("admin.eyebrow")}</p>
          <h1>{t("admin.title")}</h1>
          <p>{t("admin.subtitle")}</p>
        </div>
        <Button
          color="light"
          className="admin-refresh-button"
          onClick={refresh}
          disabled={loading}
          aria-label={t("admin.refresh")}
          title={t("admin.refresh")}
        >
          <i className={`bx bx-refresh ${loading ? "bx-spin" : ""}`} />
        </Button>
      </header>

      <nav className="admin-monitoring-tabs" aria-label={t("admin.sections")}>
        {(["overview", "moderation", "messages", "audits"] as AdminView[]).map(
          tab => (
            <button
              type="button"
              key={tab}
              className={view === tab ? "active" : ""}
              onClick={() => changeView(tab)}
            >
              {t(`admin.${tab === "messages" ? "messageAudit" : tab}`)}
            </button>
          ),
        )}
      </nav>

      <div className="admin-monitoring-content">
        {error && <Alert color="danger">{error}</Alert>}
        {loading && !overview && (
          <div className="admin-loading-state">
            <Spinner size="sm" />
            <span>{t("admin.loading")}</span>
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
                <h2 id="message-audit-title">{t("admin.messageAudit")}</h2>
                <p>{t("admin.auditDescription")}</p>
              </div>
              <Badge color="warning" pill>
                {t("admin.contentMasked")}
              </Badge>
            </div>

            <Form className="admin-filter-bar" onSubmit={submitFilters}>
              <FormGroup>
                <Label for="admin-message-search">
                  {t("admin.senderOrConversation")}
                </Label>
                <Input
                  id="admin-message-search"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder={t("admin.searchMetadata")}
                />
              </FormGroup>
              <FormGroup>
                <Label for="admin-conversation-type">
                  {t("admin.conversationType")}
                </Label>
                <Input
                  id="admin-conversation-type"
                  type="select"
                  value={conversationType}
                  onChange={event => setConversationType(event.target.value)}
                >
                  <option value="">{t("admin.allTypes")}</option>
                  <option value="direct">{t("admin.direct")}</option>
                  <option value="group">{t("admin.group")}</option>
                  <option value="management">{t("admin.management")}</option>
                </Input>
              </FormGroup>
              <FormGroup>
                <Label for="admin-attachment-filter">
                  {t("admin.attachments")}
                </Label>
                <Input
                  id="admin-attachment-filter"
                  type="select"
                  value={attachmentFilter}
                  onChange={event => setAttachmentFilter(event.target.value)}
                >
                  <option value="">{t("admin.allMessages")}</option>
                  <option value="yes">{t("admin.withAttachments")}</option>
                  <option value="no">{t("admin.withoutAttachments")}</option>
                </Input>
              </FormGroup>
              <Button color="primary" type="submit" disabled={loading}>
                {t("common.applyFilters")}
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
              ? t("admin.reviewReport")
              : t("admin.revealContent")}
          </ModalHeader>
          <ModalBody>
            {revealedContent === null ? (
              <>
                {selectedReport && <ReportContext report={selectedReport} />}
                <Alert color="warning">
                  {t("admin.permanentAuditWarning")}
                </Alert>
                <FormGroup>
                  <Label for="message-access-reason">
                    {t("common.reason")}
                  </Label>
                  <Input
                    id="message-access-reason"
                    type="select"
                    value={reason}
                    onChange={event =>
                      setReason(event.target.value as AdminMessageAccessReason)
                    }
                  >
                    {Object.entries(REASON_LABEL_KEYS).map(
                      ([value, labelKey]) => (
                        <option value={value} key={value}>
                          {t(labelKey)}
                        </option>
                      ),
                    )}
                  </Input>
                </FormGroup>
                <FormGroup>
                  <Label for="message-access-justification">
                    {t("admin.justification")}
                  </Label>
                  <Input
                    id="message-access-justification"
                    type="textarea"
                    rows={4}
                    maxLength={500}
                    value={justification}
                    onChange={event => setJustification(event.target.value)}
                    placeholder={t("admin.justificationPlaceholder")}
                    required
                  />
                  <small>
                    {t("admin.characters", {
                      count: justification.trim().length,
                    })}
                  </small>
                </FormGroup>
              </>
            ) : (
              <>
                <div className="admin-revealed-content">
                  <span>{t("admin.revealedContent")}</span>
                  <p>{revealedContent || t("admin.noTextAttachmentOnly")}</p>
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
                    <h6>{t("moderation.decision")}</h6>
                    <FormGroup>
                      <Label for="moderation-resolution-action">
                        {t("common.action")}
                      </Label>
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
                        {Object.entries(RESOLUTION_LABEL_KEYS).map(
                          ([value, labelKey]) => {
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
                                {t(labelKey)}
                              </option>
                            );
                          },
                        )}
                      </Input>
                    </FormGroup>
                    {resolutionAction === "suspend_user" && (
                      <FormGroup>
                        <Label for="moderation-suspension-hours">
                          {t("moderation.suspensionDuration")}
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
                        <small>{t("moderation.suspensionHoursHelp")}</small>
                      </FormGroup>
                    )}
                    <FormGroup className="mb-0">
                      <Label for="moderation-resolution-note">
                        {t("moderation.decisionNote")}
                      </Label>
                      <Input
                        id="moderation-resolution-note"
                        type="textarea"
                        rows={3}
                        maxLength={500}
                        value={resolutionNote}
                        disabled={resolving}
                        placeholder={t("moderation.decisionPlaceholder")}
                        onChange={event =>
                          setResolutionNote(event.target.value)
                        }
                      />
                      <small>
                        {t("admin.characters", {
                          count: resolutionNote.trim().length,
                        })}
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
              {t("common.close")}
            </Button>
            {revealedContent === null && (
              <Button
                color="danger"
                type="submit"
                disabled={revealing || justification.trim().length < 5}
              >
                {revealing ? <Spinner size="sm" /> : t("admin.recordAndReveal")}
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
  const { t } = useTranslation();

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
          <h6 id="revealed-attachments-title">{t("admin.attachments")}</h6>
          <p>{t("admin.attachmentsHint")}</p>
        </div>
        <Badge color="danger" pill>
          {t("admin.file", { count: attachments.length })}
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
                  aria-label={t("admin.downloadFile", {
                    name: attachment.fileName,
                  })}
                  title={t("admin.downloadFile", {
                    name: attachment.fileName,
                  })}
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
                  <span>
                    {t(isImage ? "admin.showImage" : "admin.loadAudio")}
                  </span>
                  <small>{t("admin.sensitiveMedia")}</small>
                </button>
              )}

              {isImage && isVisible && objectUrl && (
                <img
                  src={objectUrl}
                  alt={t("admin.auditedAttachment", {
                    name: attachment.fileName,
                  })}
                  className="admin-attachment-preview"
                />
              )}

              {isAudio && isVisible && objectUrl && (
                <audio
                  controls
                  src={objectUrl}
                  className="admin-attachment-audio"
                >
                  {t("admin.audioUnsupported")}
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
}) => {
  const { t, i18n } = useTranslation();

  return (
    <section aria-labelledby="moderation-queue-title">
      <div className="admin-section-heading">
        <div>
          <h2 id="moderation-queue-title">{t("moderation.queue")}</h2>
          <p>{t("moderation.queueDescription")}</p>
        </div>
        <Badge color={status === "pending" ? "danger" : "secondary"} pill>
          {data?.pageInfo.total ?? 0} {t(`moderation.${status}`)}
        </Badge>
      </div>

      <div className="admin-filter-bar admin-moderation-filter-bar">
        <FormGroup>
          <Label for="moderation-status-filter">{t("common.status")}</Label>
          <Input
            id="moderation-status-filter"
            type="select"
            value={status}
            onChange={event =>
              onStatusChange(event.target.value as MessageReportStatus)
            }
          >
            <option value="pending">{t("moderation.pending")}</option>
            <option value="resolved">{t("moderation.resolved")}</option>
            <option value="dismissed">{t("moderation.dismissed")}</option>
          </Input>
        </FormGroup>
        <FormGroup>
          <Label for="moderation-reason-filter">{t("common.reason")}</Label>
          <Input
            id="moderation-reason-filter"
            type="select"
            value={reason}
            onChange={event =>
              onReasonChange(event.target.value as MessageReportReason | "")
            }
          >
            <option value="">{t("moderation.allReasons")}</option>
            {Object.entries(REPORT_REASON_LABEL_KEYS).map(
              ([value, labelKey]) => (
                <option value={value} key={value}>
                  {t(labelKey)}
                </option>
              ),
            )}
          </Input>
        </FormGroup>
        <Button color="primary" disabled={loading} onClick={onApply}>
          {t("common.applyFilters")}
        </Button>
      </div>

      <div className="admin-table-region">
        <Table responsive hover className="admin-monitoring-table">
          <thead>
            <tr>
              <th>{t("moderation.reported")}</th>
              <th>{t("moderation.reporter")}</th>
              <th>{t("moderation.conversation")}</th>
              <th>{t("common.reason")}</th>
              <th>{t("moderation.accountHistory")}</th>
              <th>{t("common.status")}</th>
              <th>
                <span className="visually-hidden">{t("common.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {!loading && data?.items.length === 0 && (
              <tr>
                <td colSpan={7} className="admin-empty-cell">
                  {t("moderation.noMatches")}
                </td>
              </tr>
            )}
            {data?.items.map(report => (
              <tr key={report.id}>
                <td>
                  <strong>
                    {report.reportedUser?.username ||
                      t("moderation.formerUser")}
                  </strong>
                  <small>
                    {formatDate(report.createdAt, i18n.resolvedLanguage)}
                  </small>
                </td>
                <td>
                  <strong>
                    {report.reporter?.username || t("moderation.formerUser")}
                  </strong>
                  <small>{report.reporter?.email || report.reporterId}</small>
                </td>
                <td>
                  <strong>
                    {conversationLabel(report.message.conversation, t)}
                  </strong>
                  <small>
                    {t(`admin.${report.message.conversation.type}`)}
                  </small>
                </td>
                <td>
                  <Badge color="warning">
                    {t(REPORT_REASON_LABEL_KEYS[report.reason])}
                  </Badge>
                </td>
                <td>
                  <strong>
                    {t("moderation.warning", {
                      count: report.reportedUser?.warningCount ?? 0,
                    })}
                  </strong>
                  <small>
                    {report.reportedUser?.suspendedUntil
                      ? t("moderation.suspendedUntil", {
                          date: formatDate(
                            report.reportedUser.suspendedUntil,
                            i18n.resolvedLanguage,
                          ),
                        })
                      : t("moderation.notSuspended")}
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
                    {t(`moderation.${report.status}`)}
                  </Badge>
                  {report.resolutionAction && (
                    <small>
                      {t(RESOLUTION_LABEL_KEYS[report.resolutionAction])}
                    </small>
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
                      {t("moderation.review")}
                    </Button>
                  ) : (
                    <span className="text-muted font-size-11">
                      {report.reviewedByAdmin?.username ||
                        t("moderation.reviewed")}
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
};

const ReportContext = ({ report }: { report: AdminModerationReport }) => {
  const { t } = useTranslation();

  return (
    <div className="admin-report-context">
      <div>
        <span>{t("moderation.reportReason")}</span>
        <strong>{t(REPORT_REASON_LABEL_KEYS[report.reason])}</strong>
      </div>
      <div>
        <span>{t("moderation.reporter")}</span>
        <strong>
          {report.reporter?.username || t("moderation.formerUser")}
        </strong>
      </div>
      <div>
        <span>{t("moderation.reportedUser")}</span>
        <strong>
          {report.reportedUser?.username || t("moderation.formerUser")}
        </strong>
      </div>
      <p>{report.details || t("moderation.noDetails")}</p>
    </div>
  );
};

const OverviewView = ({
  overview,
  liveDelta,
  liveStatus,
}: {
  overview: AdminOverview;
  liveDelta: AdminOverviewLiveDelta | null;
  liveStatus: OverviewLiveStatus;
}) => {
  const { t, i18n } = useTranslation();
  const stats = [
    [t("admin.metrics.users"), overview.totals.users],
    [t("admin.metrics.conversations"), overview.totals.conversations],
    [t("admin.metrics.messages"), overview.totals.messages],
    [t("admin.metrics.storedFiles"), overview.totals.attachments],
    [
      t("admin.metrics.storedData"),
      formatBytes(overview.totals.attachmentBytes),
    ],
    [t("admin.metrics.activeSockets"), overview.runtime.gauges.activeSockets],
    [t("admin.metrics.openTickets"), overview.totals.openSupportTickets],
    [
      t("admin.metrics.contentAccesses"),
      overview.totals.messageContentAccesses,
    ],
  ];
  const liveMetrics = [
    [
      t("admin.metrics.httpRequests"),
      formatLiveChange(liveDelta?.httpRequests),
    ],
    [
      t("admin.metrics.socketEvents"),
      formatLiveChange(liveDelta?.socketEvents),
    ],
    [
      t("admin.metrics.messagesCreated"),
      formatLiveChange(liveDelta?.messagesCreated),
    ],
    [t("admin.metrics.activeSockets"), liveDelta?.activeSockets ?? 0],
  ];
  const liveStatusLabel =
    liveStatus === "live"
      ? t("admin.live")
      : liveStatus === "delayed"
        ? t("admin.updateDelayed")
        : t("admin.connecting");

  return (
    <section aria-labelledby="operations-overview-title">
      <div className="admin-section-heading">
        <div>
          <h2 id="operations-overview-title">
            {t("admin.operationsOverview")}
          </h2>
          <p>{t("admin.overviewDescription")}</p>
        </div>
        <div className="admin-overview-status">
          <span className={`admin-live-status is-${liveStatus}`} role="status">
            <span aria-hidden="true" />
            {liveStatusLabel}
          </span>
          <span className="admin-collected-at">
            {t("admin.updatedAt", {
              date: formatLiveDate(overview.collectedAt, i18n.resolvedLanguage),
            })}
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
          <h3 id="live-data-title">{t("admin.liveActivity")}</h3>
          <p>{t("admin.liveActivityDescription")}</p>
        </div>
        <dl aria-live="polite">
          {liveMetrics.map(([label, value]) => (
            <Metric label={String(label)} value={value} key={label} />
          ))}
        </dl>
      </section>

      <div className="admin-overview-bands">
        <section>
          <h3>{t("admin.last24Hours")}</h3>
          <dl>
            <Metric
              label={t("admin.metrics.newUsers")}
              value={overview.activity24h.newUsers}
            />
            <Metric
              label={t("admin.metrics.newConversations")}
              value={overview.activity24h.newConversations}
            />
            <Metric
              label={t("admin.metrics.messages")}
              value={overview.activity24h.messages}
            />
            <Metric
              label={t("admin.metrics.attachments")}
              value={overview.activity24h.attachments}
            />
            <Metric
              label={t("admin.metrics.calls")}
              value={overview.activity24h.calls}
            />
            <Metric
              label={t("admin.metrics.contentAccesses")}
              value={overview.activity24h.messageContentAccesses}
            />
          </dl>
        </section>
        <section>
          <h3>{t("admin.runtimeTraffic")}</h3>
          <dl>
            <Metric
              label={t("admin.metrics.httpRequests")}
              value={overview.runtime.counters.httpRequestsTotal}
            />
            <Metric
              label={t("admin.metrics.httpErrors")}
              value={overview.runtime.counters.httpErrorsTotal}
            />
            <Metric
              label={t("admin.metrics.socketEvents")}
              value={overview.runtime.counters.socketEventsTotal}
            />
            <Metric
              label={t("admin.metrics.socketErrors")}
              value={overview.runtime.counters.socketErrorsTotal}
            />
            <Metric
              label={t("admin.metrics.averageResponse")}
              value={`${overview.runtime.gauges.averageHttpDurationMs} ms`}
            />
            <Metric
              label={t("admin.metrics.uptime")}
              value={`${Math.floor(overview.runtime.uptimeSeconds / 60)} min`}
            />
          </dl>
        </section>
        <section>
          <h3>{t("admin.conversationMix")}</h3>
          <dl>
            <Metric
              label={t("admin.direct")}
              value={overview.totals.directConversations}
            />
            <Metric
              label={t("admin.metrics.groups")}
              value={overview.totals.groupConversations}
            />
            <Metric
              label={t("admin.management")}
              value={overview.totals.managementConversations}
            />
            <Metric
              label={t("admin.metrics.automationGroups")}
              value={overview.totals.botManagedGroups}
            />
            <Metric
              label={t("admin.metrics.calls")}
              value={overview.totals.calls}
            />
            <Metric
              label={t("admin.metrics.deletedMessages")}
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
}) => {
  const { t, i18n } = useTranslation();

  return (
    <div className="admin-table-region">
      <Table responsive hover className="admin-monitoring-table">
        <thead>
          <tr>
            <th>{t("admin.sent")}</th>
            <th>{t("admin.sender")}</th>
            <th>{t("moderation.conversation")}</th>
            <th>{t("admin.type")}</th>
            <th>{t("admin.files")}</th>
            <th>{t("admin.content")}</th>
            <th>
              <span className="visually-hidden">{t("common.actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {!loading && data?.items.length === 0 && (
            <tr>
              <td colSpan={7} className="admin-empty-cell">
                {t("admin.noMessageMetadata")}
              </td>
            </tr>
          )}
          {data?.items.map(message => (
            <tr key={message.id}>
              <td>{formatDate(message.createdAt, i18n.resolvedLanguage)}</td>
              <td>
                <strong>
                  {message.sender?.username || t("admin.elloSystem")}
                </strong>
                <small>{message.sender?.email || t("admin.systemEvent")}</small>
              </td>
              <td>
                <strong>{conversationLabel(message.conversation, t)}</strong>
                <small>
                  {t(`admin.${message.conversation.type}`)} ·{" "}
                  {t("admin.participant", {
                    count: message.conversation.participantCount,
                  })}
                </small>
              </td>
              <td>
                <Badge
                  color={message.messageType === "system" ? "info" : "light"}
                >
                  {t(`admin.messageType.${message.messageType}`)}
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
                  {t(`admin.contentState.${message.contentState}`)}
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
                  {t("admin.reveal")}
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
};

const AuditView = ({
  data,
  loading,
  onPage,
}: {
  data: AdminAuditList | null;
  loading: boolean;
  onPage: (offset: number) => void;
}) => {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="access-log-title">
      <div className="admin-section-heading">
        <div>
          <h2 id="access-log-title">{t("admin.messageAccessLog")}</h2>
          <p>{t("admin.accessLogDescription")}</p>
        </div>
      </div>
      <div className="admin-table-region">
        <Table responsive hover className="admin-monitoring-table">
          <thead>
            <tr>
              <th>{t("admin.accessed")}</th>
              <th>{t("admin.administrator")}</th>
              <th>{t("admin.messageContext")}</th>
              <th>{t("common.reason")}</th>
              <th>{t("admin.justification")}</th>
            </tr>
          </thead>
          <tbody>
            {!loading && data?.items.length === 0 && (
              <tr>
                <td colSpan={5} className="admin-empty-cell">
                  {t("admin.noContentAccess")}
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
};

const AuditRow = ({ audit }: { audit: AdminMessageAccessAudit }) => {
  const { t, i18n } = useTranslation();
  const conversation =
    audit.message.conversation?.name ||
    (audit.message.conversation?.type
      ? t(`admin.${audit.message.conversation.type}`)
      : t("admin.deletedConversation"));

  return (
    <tr>
      <td>{formatDate(audit.createdAt, i18n.resolvedLanguage)}</td>
      <td>
        <strong>{audit.admin?.username || t("admin.formerAdmin")}</strong>
        <small>{audit.admin?.email || audit.message.id}</small>
      </td>
      <td>
        <strong>{conversation}</strong>
        <small>{audit.message.sender?.username || t("admin.elloSystem")}</small>
      </td>
      <td>
        <Badge color="secondary">{t(REASON_LABEL_KEYS[audit.reason])}</Badge>
      </td>
      <td className="admin-justification-cell">{audit.justification}</td>
    </tr>
  );
};

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
  const { t } = useTranslation();

  if (!pageInfo) {
    return null;
  }
  const start = pageInfo.total === 0 ? 0 : pageInfo.offset + 1;
  const end = Math.min(pageInfo.offset + pageInfo.limit, pageInfo.total);

  return (
    <div className="admin-pagination">
      <span>
        {t("admin.resultRange", { start, end, total: pageInfo.total })}
      </span>
      <div>
        <Button
          color="light"
          size="sm"
          disabled={loading || pageInfo.offset === 0}
          onClick={() => onPage(Math.max(0, pageInfo.offset - pageInfo.limit))}
          aria-label={t("admin.previousPage")}
          title={t("admin.previousPage")}
        >
          <i className="bx bx-chevron-left" />
        </Button>
        <Button
          color="light"
          size="sm"
          disabled={loading || !pageInfo.hasMore}
          onClick={() => onPage(pageInfo.offset + pageInfo.limit)}
          aria-label={t("admin.nextPage")}
          title={t("admin.nextPage")}
        >
          <i className="bx bx-chevron-right" />
        </Button>
      </div>
    </div>
  );
};

export default AdminPanel;
