import React, { FormEvent, useCallback, useEffect, useState } from "react";
import type { TFunction } from "i18next";
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
} from "reactstrap";
import {
  assignSupportTicket,
  claimSupportTicket,
  createSupportTicket,
  getSupportTicket,
  getSupportTickets,
  SupportTicket,
  SupportTicketActivity,
  SupportTicketAssignment,
  SupportTicketPriority,
  SupportTicketStatus,
  SupportTicketUser,
  updateSupportTicket,
} from "../../../api/tickets";
import { getCurrentAuthUser } from "../../../api/backendAdapters";
import { getUsers } from "../../../api/chats";
import { getChatSocket } from "../../../api/realtime";
import AppSimpleBar from "../../../components/AppSimpleBar";
import LeftbarTitle from "../../../components/LeftbarTitle";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../../../helpers/notifications";

const PRIORITY_LABEL_KEYS: Record<SupportTicketPriority, string> = {
  low: "support.low",
  medium: "support.medium",
  high: "support.high",
};

const STATUS_LABEL_KEYS: Record<SupportTicketStatus, string> = {
  open: "support.open",
  in_progress: "support.inProgress",
  resolved: "support.resolved",
  closed: "support.closed",
};

const STATUS_COLORS: Record<SupportTicketStatus, string> = {
  open: "primary",
  in_progress: "warning",
  resolved: "success",
  closed: "secondary",
};

const formatTicketDate = (value: string, locale?: string) =>
  new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const getAdminName = (
  adminId: string | null,
  admins: SupportTicketUser[],
  t: TFunction,
) => {
  if (!adminId) {
    return t("support.unassigned");
  }
  return (
    admins.find(admin => admin.id === adminId)?.username ||
    t("support.formerAdmin")
  );
};

interface TicketRealtimeEvent {
  ticketId: string;
  requesterId: string;
  version: number;
}

const describeActivity = (
  activity: SupportTicketActivity,
  admins: SupportTicketUser[],
  t: TFunction,
) => {
  switch (activity.action) {
    case "created":
      return t("support.activityCreated");
    case "assigned":
      return t("support.activityAssigned", {
        name: getAdminName(activity.toValue, admins, t),
      });
    case "unassigned":
      return t("support.activityUnassigned");
    case "transferred":
      return t("support.activityTransferred", {
        from: getAdminName(activity.fromValue, admins, t),
        to: getAdminName(activity.toValue, admins, t),
      });
    case "status_changed":
      return t("support.activityStatusChanged", {
        from:
          t(STATUS_LABEL_KEYS[activity.fromValue as SupportTicketStatus]) ||
          activity.fromValue,
        to:
          t(STATUS_LABEL_KEYS[activity.toValue as SupportTicketStatus]) ||
          activity.toValue,
      });
    case "priority_changed":
      return t("support.activityPriorityChanged", {
        from:
          t(PRIORITY_LABEL_KEYS[activity.fromValue as SupportTicketPriority]) ||
          activity.fromValue,
        to:
          t(PRIORITY_LABEL_KEYS[activity.toValue as SupportTicketPriority]) ||
          activity.toValue,
      });
    case "note_updated":
      return activity.toValue === "set"
        ? t("support.activityNoteUpdated")
        : t("support.activityNoteCleared");
    default:
      return t("support.activityUpdated");
  }
};

const Support = () => {
  const { t, i18n } = useTranslation();
  const currentUser = getCurrentAuthUser();
  const currentUserId = String(currentUser?.id || currentUser?.uid || "");
  const isAdmin = currentUser?.role === "admin";
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [admins, setAdmins] = useState<SupportTicketUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<SupportTicketPriority>("medium");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assignmentFilter, setAssignmentFilter] =
    useState<SupportTicketAssignment>("all");
  const [search, setSearch] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(
    null,
  );
  const [editStatus, setEditStatus] = useState<SupportTicketStatus>("open");
  const [editPriority, setEditPriority] =
    useState<SupportTicketPriority>("medium");
  const [editAssignee, setEditAssignee] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [assignmentSaving, setAssignmentSaving] = useState(false);

  const loadTickets = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setLoading(true);
      }
      setError("");
      try {
        const response = await getSupportTickets({
          status: statusFilter
            ? (statusFilter as SupportTicketStatus)
            : undefined,
          priority: priorityFilter
            ? (priorityFilter as SupportTicketPriority)
            : undefined,
          assignment: isAdmin ? assignmentFilter : undefined,
          search: search.trim() || undefined,
        });
        setTickets(response.items || []);
      } catch (requestError: any) {
        setError(String(requestError || t("support.loadFailed")));
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [assignmentFilter, isAdmin, priorityFilter, search, statusFilter, t],
  );

  useEffect(() => {
    const timeout = window.setTimeout(
      () => void loadTickets(),
      search ? 250 : 0,
    );
    return () => window.clearTimeout(timeout);
  }, [loadTickets, search]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    getUsers(true)
      .then(users =>
        setAdmins(
          users
            .filter((user: any) => user.role === "admin")
            .map((user: any) => ({
              id: user.id,
              username: user.username,
              email: user.email,
            })),
        ),
      )
      .catch(() => setAdmins([]));
  }, [isAdmin]);

  const syncTicket = useCallback((ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setEditStatus(ticket.status);
    setEditPriority(ticket.priority);
    setEditAssignee(ticket.assignedAdminId || "");
    setAdminNote(ticket.adminNote || "");
    setTickets(items =>
      items.map(item => (item.id === ticket.id ? ticket : item)),
    );
  }, []);

  const refreshTicket = useCallback(
    async (ticketId: string) => {
      try {
        syncTicket(await getSupportTicket(ticketId));
      } catch {
        setSelectedTicket(null);
      }
    },
    [syncTicket],
  );

  useEffect(() => {
    const socket = getChatSocket();
    if (!socket) {
      return;
    }

    const refreshFromRealtime = (event: TicketRealtimeEvent) => {
      void loadTickets(false);
      if (selectedTicket?.id === event.ticketId) {
        void refreshTicket(event.ticketId);
      }
    };

    socket.on("ticket:created", refreshFromRealtime);
    socket.on("ticket:updated", refreshFromRealtime);
    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("ticket:created", refreshFromRealtime);
      socket.off("ticket:updated", refreshFromRealtime);
    };
  }, [loadTickets, refreshTicket, selectedTicket?.id]);

  const handleActionError = async (requestError: any, ticketId: string) => {
    showErrorNotification(String(requestError || t("support.updateFailed")));
    await Promise.all([loadTickets(), refreshTicket(ticketId)]);
  };

  const submitTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await createSupportTicket({ subject, message, priority });
      setSubject("");
      setMessage("");
      setPriority("medium");
      showSuccessNotification(t("support.requestSent"));
      await loadTickets();
    } catch (requestError: any) {
      showErrorNotification(String(requestError || t("support.sendFailed")));
    } finally {
      setSubmitting(false);
    }
  };

  const openTicket = async (ticket: SupportTicket) => {
    syncTicket(ticket);
    await refreshTicket(ticket.id);
  };

  const assignToMe = async () => {
    if (!selectedTicket || !isAdmin || !currentUserId) {
      return;
    }
    setAssignmentSaving(true);
    try {
      const updated = selectedTicket.assignedAdminId
        ? await assignSupportTicket(
            selectedTicket.id,
            currentUserId,
            selectedTicket.version,
          )
        : await claimSupportTicket(selectedTicket.id, selectedTicket.version);
      syncTicket(updated);
      showSuccessNotification(t("support.assignedSuccess"));
      await loadTickets();
    } catch (requestError: any) {
      await handleActionError(requestError, selectedTicket.id);
    } finally {
      setAssignmentSaving(false);
    }
  };

  const saveAssignment = async () => {
    if (!selectedTicket || !isAdmin) {
      return;
    }
    setAssignmentSaving(true);
    try {
      const updated = await assignSupportTicket(
        selectedTicket.id,
        editAssignee || null,
        selectedTicket.version,
      );
      syncTicket(updated);
      showSuccessNotification(t("support.assignmentUpdated"));
      await loadTickets();
    } catch (requestError: any) {
      await handleActionError(requestError, selectedTicket.id);
    } finally {
      setAssignmentSaving(false);
    }
  };

  const saveTicket = async () => {
    if (!selectedTicket || !isAdmin) {
      return;
    }
    setSaving(true);
    try {
      const updated = await updateSupportTicket(selectedTicket.id, {
        expectedVersion: selectedTicket.version,
        status: editStatus,
        priority: editPriority,
        adminNote,
      });
      syncTicket(updated);
      showSuccessNotification(t("support.ticketUpdated"));
      await loadTickets();
    } catch (requestError: any) {
      await handleActionError(requestError, selectedTicket.id);
    } finally {
      setSaving(false);
    }
  };

  const isAssignedToMe = Boolean(
    selectedTicket && selectedTicket.assignedAdminId === currentUserId,
  );
  const assignmentChanged =
    selectedTicket && editAssignee !== (selectedTicket.assignedAdminId || "");

  return (
    <div className="support-panel position-relative">
      <LeftbarTitle
        title={t(isAdmin ? "support.ticketsTitle" : "support.title")}
      />
      <AppSimpleBar className="support-panel-scroll">
        <div className="px-4 pb-4">
          {!isAdmin && (
            <section
              className="support-create-section"
              aria-labelledby="support-create-title"
            >
              <h5 id="support-create-title">{t("support.createRequest")}</h5>
              <Form onSubmit={submitTicket}>
                <FormGroup>
                  <Label for="support-subject">{t("support.subject")}</Label>
                  <Input
                    id="support-subject"
                    value={subject}
                    onChange={event => setSubject(event.target.value)}
                    minLength={3}
                    maxLength={120}
                    placeholder={t("support.subject")}
                    required
                  />
                </FormGroup>
                <FormGroup>
                  <Label for="support-message">{t("support.message")}</Label>
                  <Input
                    id="support-message"
                    type="textarea"
                    value={message}
                    onChange={event => setMessage(event.target.value)}
                    minLength={10}
                    maxLength={2000}
                    placeholder={t("support.yourMessage")}
                    rows={4}
                    required
                  />
                </FormGroup>
                <FormGroup>
                  <Label for="support-priority">{t("support.priority")}</Label>
                  <Input
                    id="support-priority"
                    type="select"
                    value={priority}
                    onChange={event =>
                      setPriority(event.target.value as SupportTicketPriority)
                    }
                  >
                    <option value="low">{t("support.low")}</option>
                    <option value="medium">{t("support.medium")}</option>
                    <option value="high">{t("support.high")}</option>
                  </Input>
                </FormGroup>
                <Button
                  color="primary"
                  type="submit"
                  disabled={submitting}
                  block
                >
                  {submitting ? (
                    <Spinner size="sm" aria-label={t("support.sending")} />
                  ) : (
                    <>
                      <i className="bx bx-send me-2" aria-hidden="true"></i>
                      {t("support.send")}
                    </>
                  )}
                </Button>
              </Form>
            </section>
          )}

          <section
            className="support-list-section"
            aria-labelledby="support-list-title"
          >
            <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
              <h5 id="support-list-title" className="mb-0">
                {t(isAdmin ? "support.sharedQueue" : "support.myRequests")}
              </h5>
              <Button
                color="light"
                size="sm"
                className="support-refresh-button"
                onClick={() => void loadTickets()}
                aria-label={t("support.refreshTickets")}
                title={t("support.refresh")}
              >
                <i className="bx bx-refresh" aria-hidden="true"></i>
              </Button>
            </div>

            {isAdmin && (
              <div className="support-filters mb-3">
                <Input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder={t("support.searchTickets")}
                  aria-label={t("support.searchTicketsAria")}
                />
                <Input
                  type="select"
                  value={assignmentFilter}
                  onChange={event =>
                    setAssignmentFilter(
                      event.target.value as SupportTicketAssignment,
                    )
                  }
                  aria-label={t("support.filterAssignment")}
                >
                  <option value="all">{t("support.allAssignments")}</option>
                  <option value="mine">{t("support.assignedToMe")}</option>
                  <option value="unassigned">{t("support.unassigned")}</option>
                </Input>
                <Input
                  type="select"
                  value={statusFilter}
                  onChange={event => setStatusFilter(event.target.value)}
                  aria-label={t("support.filterStatus")}
                >
                  <option value="">{t("support.allStatuses")}</option>
                  {Object.entries(STATUS_LABEL_KEYS).map(
                    ([value, labelKey]) => (
                      <option key={value} value={value}>
                        {t(labelKey)}
                      </option>
                    ),
                  )}
                </Input>
                <Input
                  type="select"
                  value={priorityFilter}
                  onChange={event => setPriorityFilter(event.target.value)}
                  aria-label={t("support.filterPriority")}
                >
                  <option value="">{t("support.allPriorities")}</option>
                  {Object.entries(PRIORITY_LABEL_KEYS).map(
                    ([value, labelKey]) => (
                      <option key={value} value={value}>
                        {t(labelKey)}
                      </option>
                    ),
                  )}
                </Input>
              </div>
            )}

            {error && <Alert color="danger">{error}</Alert>}
            {loading ? (
              <div className="support-loading text-muted">
                <Spinner size="sm" /> {t("support.loading")}
              </div>
            ) : tickets.length === 0 ? (
              <div className="support-empty text-muted">
                <i className="bx bx-support" aria-hidden="true"></i>
                <span>{t("support.noRequests")}</span>
              </div>
            ) : (
              <div className="support-ticket-list">
                {tickets.map(ticket => (
                  <button
                    key={ticket.id}
                    type="button"
                    className={`support-ticket-item priority-${ticket.priority}`}
                    onClick={() => openTicket(ticket)}
                  >
                    <span className="support-ticket-heading">
                      <strong>{ticket.subject}</strong>
                      <Badge color={STATUS_COLORS[ticket.status]} pill>
                        {t(STATUS_LABEL_KEYS[ticket.status])}
                      </Badge>
                    </span>
                    {isAdmin && (
                      <span className="support-ticket-requester">
                        {ticket.requester?.username || t("support.deletedUser")}
                      </span>
                    )}
                    <span className="support-ticket-assignee">
                      <i className="bx bx-user-check" aria-hidden="true"></i>
                      {ticket.assignedAdmin?.username ||
                        t("support.unassigned")}
                    </span>
                    <span className="support-ticket-preview">
                      {ticket.message}
                    </span>
                    <span className="support-ticket-meta">
                      {t("support.priorityLabel", {
                        priority: t(PRIORITY_LABEL_KEYS[ticket.priority]),
                      })}
                      <time dateTime={ticket.createdAt}>
                        {formatTicketDate(
                          ticket.createdAt,
                          i18n.resolvedLanguage,
                        )}
                      </time>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </AppSimpleBar>

      <Modal
        isOpen={Boolean(selectedTicket)}
        toggle={() => setSelectedTicket(null)}
        centered
        scrollable
        size="lg"
        className="support-ticket-modal"
      >
        <ModalHeader toggle={() => setSelectedTicket(null)}>
          {selectedTicket?.subject}
        </ModalHeader>
        {selectedTicket && (
          <>
            <ModalBody>
              <div className="support-ticket-detail-meta">
                <Badge color={STATUS_COLORS[selectedTicket.status]} pill>
                  {t(STATUS_LABEL_KEYS[selectedTicket.status])}
                </Badge>
                <span>
                  {t("support.priorityLabel", {
                    priority: t(PRIORITY_LABEL_KEYS[selectedTicket.priority]),
                  })}
                </span>
                <span>
                  {t("support.assignedTo", {
                    name:
                      selectedTicket.assignedAdmin?.username ||
                      t("support.nobody"),
                  })}
                </span>
                <time dateTime={selectedTicket.createdAt}>
                  {formatTicketDate(
                    selectedTicket.createdAt,
                    i18n.resolvedLanguage,
                  )}
                </time>
              </div>
              {isAdmin && selectedTicket.requester && (
                <div className="support-requester-detail">
                  <strong>{selectedTicket.requester.username}</strong>
                  <span>{selectedTicket.requester.email}</span>
                </div>
              )}
              <p className="support-ticket-message">{selectedTicket.message}</p>

              {isAdmin ? (
                <>
                  <section className="support-assignment-section">
                    <div className="support-section-heading">
                      <h6>{t("support.assignment")}</h6>
                      {!isAssignedToMe && (
                        <Button
                          color="primary"
                          size="sm"
                          onClick={assignToMe}
                          disabled={assignmentSaving}
                        >
                          <i
                            className="bx bx-user-plus me-1"
                            aria-hidden="true"
                          ></i>
                          {t("support.assignToMe")}
                        </Button>
                      )}
                    </div>
                    <div className="support-assignee-controls">
                      <Input
                        type="select"
                        value={editAssignee}
                        onChange={event => setEditAssignee(event.target.value)}
                        aria-label={t("support.ticketAssignee")}
                      >
                        <option value="">{t("support.unassigned")}</option>
                        {admins.map(admin => (
                          <option key={admin.id} value={admin.id}>
                            {admin.username}
                          </option>
                        ))}
                      </Input>
                      <Button
                        color="secondary"
                        outline
                        onClick={saveAssignment}
                        disabled={!assignmentChanged || assignmentSaving}
                      >
                        {assignmentSaving ? (
                          <Spinner size="sm" />
                        ) : (
                          t("support.apply")
                        )}
                      </Button>
                    </div>
                  </section>

                  {!isAssignedToMe && (
                    <Alert color="warning" className="mt-3 mb-0">
                      {selectedTicket.assignedAdmin
                        ? t("support.assignedWarning", {
                            name: selectedTicket.assignedAdmin.username,
                          })
                        : t("support.unassignedWarning")}
                    </Alert>
                  )}

                  <Form className="support-resolution-form">
                    <div className="row g-3">
                      <FormGroup className="col-sm-6 mb-0">
                        <Label for="ticket-status">{t("common.status")}</Label>
                        <Input
                          id="ticket-status"
                          type="select"
                          value={editStatus}
                          disabled={!isAssignedToMe}
                          onChange={event =>
                            setEditStatus(
                              event.target.value as SupportTicketStatus,
                            )
                          }
                        >
                          {Object.entries(STATUS_LABEL_KEYS).map(
                            ([value, labelKey]) => (
                              <option key={value} value={value}>
                                {t(labelKey)}
                              </option>
                            ),
                          )}
                        </Input>
                      </FormGroup>
                      <FormGroup className="col-sm-6 mb-0">
                        <Label for="ticket-edit-priority">
                          {t("support.priority")}
                        </Label>
                        <Input
                          id="ticket-edit-priority"
                          type="select"
                          value={editPriority}
                          disabled={!isAssignedToMe}
                          onChange={event =>
                            setEditPriority(
                              event.target.value as SupportTicketPriority,
                            )
                          }
                        >
                          {Object.entries(PRIORITY_LABEL_KEYS).map(
                            ([value, labelKey]) => (
                              <option key={value} value={value}>
                                {t(labelKey)}
                              </option>
                            ),
                          )}
                        </Input>
                      </FormGroup>
                    </div>
                    <FormGroup className="mt-3 mb-0">
                      <Label for="ticket-admin-note">
                        {t("support.supportResponse")}
                      </Label>
                      <Input
                        id="ticket-admin-note"
                        type="textarea"
                        rows={4}
                        maxLength={2000}
                        value={adminNote}
                        disabled={!isAssignedToMe}
                        onChange={event => setAdminNote(event.target.value)}
                        placeholder={t("support.responsePlaceholder")}
                      />
                    </FormGroup>
                  </Form>

                  <section className="support-activity-section">
                    <h6>{t("support.activity")}</h6>
                    <div className="support-activity-list">
                      {selectedTicket.activities.length ? (
                        selectedTicket.activities.map(activity => (
                          <div
                            className="support-activity-item"
                            key={activity.id}
                          >
                            <span
                              className="support-activity-marker"
                              aria-hidden="true"
                            >
                              <i className="bx bx-history"></i>
                            </span>
                            <div>
                              <strong>
                                {activity.actor?.username ||
                                  t("support.deletedUser")}
                              </strong>
                              <p>{describeActivity(activity, admins, t)}</p>
                              <time dateTime={activity.createdAt}>
                                {formatTicketDate(
                                  activity.createdAt,
                                  i18n.resolvedLanguage,
                                )}
                              </time>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="support-activity-empty text-muted">
                          {t("support.noLegacyActivity")}
                        </p>
                      )}
                    </div>
                  </section>
                </>
              ) : selectedTicket.adminNote ? (
                <div className="support-admin-note">
                  <strong>{t("support.supportResponse")}</strong>
                  <p>{selectedTicket.adminNote}</p>
                </div>
              ) : null}
            </ModalBody>
            <ModalFooter>
              <Button color="light" onClick={() => setSelectedTicket(null)}>
                {t("common.close")}
              </Button>
              {isAdmin && isAssignedToMe && (
                <Button color="primary" onClick={saveTicket} disabled={saving}>
                  {saving ? <Spinner size="sm" /> : t("support.saveChanges")}
                </Button>
              )}
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
};

export default Support;
