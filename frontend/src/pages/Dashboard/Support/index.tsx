import React, { FormEvent, useCallback, useEffect, useState } from "react";
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
import AppSimpleBar from "../../../components/AppSimpleBar";
import LeftbarTitle from "../../../components/LeftbarTitle";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../../../helpers/notifications";

const PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_COLORS: Record<SupportTicketStatus, string> = {
  open: "primary",
  in_progress: "warning",
  resolved: "success",
  closed: "secondary",
};

const formatTicketDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const getAdminName = (adminId: string | null, admins: SupportTicketUser[]) => {
  if (!adminId) {
    return "Unassigned";
  }
  return admins.find(admin => admin.id === adminId)?.username || "Former admin";
};

const describeActivity = (
  activity: SupportTicketActivity,
  admins: SupportTicketUser[],
) => {
  switch (activity.action) {
    case "created":
      return "Created the support request";
    case "assigned":
      return `Assigned to ${getAdminName(activity.toValue, admins)}`;
    case "unassigned":
      return "Moved the ticket back to the unassigned queue";
    case "transferred":
      return `Transferred from ${getAdminName(activity.fromValue, admins)} to ${getAdminName(activity.toValue, admins)}`;
    case "status_changed":
      return `Changed status from ${STATUS_LABELS[activity.fromValue as SupportTicketStatus] || activity.fromValue} to ${STATUS_LABELS[activity.toValue as SupportTicketStatus] || activity.toValue}`;
    case "priority_changed":
      return `Changed priority from ${PRIORITY_LABELS[activity.fromValue as SupportTicketPriority] || activity.fromValue} to ${PRIORITY_LABELS[activity.toValue as SupportTicketPriority] || activity.toValue}`;
    case "note_updated":
      return activity.toValue === "set"
        ? "Updated the support response"
        : "Cleared the support response";
    default:
      return "Updated the ticket";
  }
};

const Support = () => {
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

  const loadTickets = useCallback(async () => {
    setLoading(true);
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
      setError(String(requestError || "Support tickets could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [assignmentFilter, isAdmin, priorityFilter, search, statusFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(loadTickets, search ? 250 : 0);
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

  const syncTicket = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setEditStatus(ticket.status);
    setEditPriority(ticket.priority);
    setEditAssignee(ticket.assignedAdminId || "");
    setAdminNote(ticket.adminNote || "");
    setTickets(items =>
      items.map(item => (item.id === ticket.id ? ticket : item)),
    );
  };

  const refreshTicket = async (ticketId: string) => {
    try {
      syncTicket(await getSupportTicket(ticketId));
    } catch {
      setSelectedTicket(null);
    }
  };

  const handleActionError = async (requestError: any, ticketId: string) => {
    showErrorNotification(String(requestError || "Ticket update failed."));
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
      showSuccessNotification("Support request sent.");
      await loadTickets();
    } catch (requestError: any) {
      showErrorNotification(
        String(requestError || "Support request could not be sent."),
      );
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
      showSuccessNotification("Ticket assigned to you.");
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
      showSuccessNotification("Ticket assignment updated.");
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
      showSuccessNotification("Support ticket updated.");
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
      <LeftbarTitle title={isAdmin ? "Support Tickets" : "Support"} />
      <AppSimpleBar className="support-panel-scroll">
        <div className="px-4 pb-4">
          {!isAdmin && (
            <section
              className="support-create-section"
              aria-labelledby="support-create-title"
            >
              <h5 id="support-create-title">Create Support Request</h5>
              <Form onSubmit={submitTicket}>
                <FormGroup>
                  <Label for="support-subject">Subject</Label>
                  <Input
                    id="support-subject"
                    value={subject}
                    onChange={event => setSubject(event.target.value)}
                    minLength={3}
                    maxLength={120}
                    placeholder="Subject"
                    required
                  />
                </FormGroup>
                <FormGroup>
                  <Label for="support-message">Message</Label>
                  <Input
                    id="support-message"
                    type="textarea"
                    value={message}
                    onChange={event => setMessage(event.target.value)}
                    minLength={10}
                    maxLength={2000}
                    placeholder="Your message"
                    rows={4}
                    required
                  />
                </FormGroup>
                <FormGroup>
                  <Label for="support-priority">Priority</Label>
                  <Input
                    id="support-priority"
                    type="select"
                    value={priority}
                    onChange={event =>
                      setPriority(event.target.value as SupportTicketPriority)
                    }
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </Input>
                </FormGroup>
                <Button
                  color="primary"
                  type="submit"
                  disabled={submitting}
                  block
                >
                  {submitting ? (
                    <Spinner size="sm" aria-label="Sending support request" />
                  ) : (
                    <>
                      <i className="bx bx-send me-2" aria-hidden="true"></i>
                      Send
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
                {isAdmin ? "Shared Queue" : "My Requests"}
              </h5>
              <Button
                color="light"
                size="sm"
                className="support-refresh-button"
                onClick={loadTickets}
                aria-label="Refresh support tickets"
                title="Refresh"
              >
                <i className="bx bx-refresh" aria-hidden="true"></i>
              </Button>
            </div>

            {isAdmin && (
              <div className="support-filters mb-3">
                <Input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search tickets"
                  aria-label="Search support tickets"
                />
                <Input
                  type="select"
                  value={assignmentFilter}
                  onChange={event =>
                    setAssignmentFilter(
                      event.target.value as SupportTicketAssignment,
                    )
                  }
                  aria-label="Filter support tickets by assignment"
                >
                  <option value="all">All assignments</option>
                  <option value="mine">Assigned to me</option>
                  <option value="unassigned">Unassigned</option>
                </Input>
                <Input
                  type="select"
                  value={statusFilter}
                  onChange={event => setStatusFilter(event.target.value)}
                  aria-label="Filter support tickets by status"
                >
                  <option value="">All statuses</option>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Input>
                <Input
                  type="select"
                  value={priorityFilter}
                  onChange={event => setPriorityFilter(event.target.value)}
                  aria-label="Filter support tickets by priority"
                >
                  <option value="">All priorities</option>
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Input>
              </div>
            )}

            {error && <Alert color="danger">{error}</Alert>}
            {loading ? (
              <div className="support-loading text-muted">
                <Spinner size="sm" /> Loading...
              </div>
            ) : tickets.length === 0 ? (
              <div className="support-empty text-muted">
                <i className="bx bx-support" aria-hidden="true"></i>
                <span>No support requests found.</span>
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
                        {STATUS_LABELS[ticket.status]}
                      </Badge>
                    </span>
                    {isAdmin && (
                      <span className="support-ticket-requester">
                        {ticket.requester?.username || "Deleted user"}
                      </span>
                    )}
                    <span className="support-ticket-assignee">
                      <i className="bx bx-user-check" aria-hidden="true"></i>
                      {ticket.assignedAdmin?.username || "Unassigned"}
                    </span>
                    <span className="support-ticket-preview">
                      {ticket.message}
                    </span>
                    <span className="support-ticket-meta">
                      {PRIORITY_LABELS[ticket.priority]} priority
                      <time dateTime={ticket.createdAt}>
                        {formatTicketDate(ticket.createdAt)}
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
                  {STATUS_LABELS[selectedTicket.status]}
                </Badge>
                <span>{PRIORITY_LABELS[selectedTicket.priority]} priority</span>
                <span>
                  Assigned to{" "}
                  {selectedTicket.assignedAdmin?.username || "nobody"}
                </span>
                <time dateTime={selectedTicket.createdAt}>
                  {formatTicketDate(selectedTicket.createdAt)}
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
                      <h6>Assignment</h6>
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
                          Assign to me
                        </Button>
                      )}
                    </div>
                    <div className="support-assignee-controls">
                      <Input
                        type="select"
                        value={editAssignee}
                        onChange={event => setEditAssignee(event.target.value)}
                        aria-label="Ticket assignee"
                      >
                        <option value="">Unassigned</option>
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
                        {assignmentSaving ? <Spinner size="sm" /> : "Apply"}
                      </Button>
                    </div>
                  </section>

                  {!isAssignedToMe && (
                    <Alert color="warning" className="mt-3 mb-0">
                      {selectedTicket.assignedAdmin
                        ? `This ticket is assigned to ${selectedTicket.assignedAdmin.username}. Assign it to yourself or transfer it before editing.`
                        : "This ticket is unassigned. Claim it before editing."}
                    </Alert>
                  )}

                  <Form className="support-resolution-form">
                    <div className="row g-3">
                      <FormGroup className="col-sm-6 mb-0">
                        <Label for="ticket-status">Status</Label>
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
                          {Object.entries(STATUS_LABELS).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </Input>
                      </FormGroup>
                      <FormGroup className="col-sm-6 mb-0">
                        <Label for="ticket-edit-priority">Priority</Label>
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
                          {Object.entries(PRIORITY_LABELS).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ),
                          )}
                        </Input>
                      </FormGroup>
                    </div>
                    <FormGroup className="mt-3 mb-0">
                      <Label for="ticket-admin-note">Support response</Label>
                      <Input
                        id="ticket-admin-note"
                        type="textarea"
                        rows={4}
                        maxLength={2000}
                        value={adminNote}
                        disabled={!isAssignedToMe}
                        onChange={event => setAdminNote(event.target.value)}
                        placeholder="Add a response or resolution note"
                      />
                    </FormGroup>
                  </Form>

                  <section className="support-activity-section">
                    <h6>Activity</h6>
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
                                {activity.actor?.username || "Deleted user"}
                              </strong>
                              <p>{describeActivity(activity, admins)}</p>
                              <time dateTime={activity.createdAt}>
                                {formatTicketDate(activity.createdAt)}
                              </time>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="support-activity-empty text-muted">
                          No activity was recorded for this legacy ticket.
                        </p>
                      )}
                    </div>
                  </section>
                </>
              ) : selectedTicket.adminNote ? (
                <div className="support-admin-note">
                  <strong>Support response</strong>
                  <p>{selectedTicket.adminNote}</p>
                </div>
              ) : null}
            </ModalBody>
            <ModalFooter>
              <Button color="light" onClick={() => setSelectedTicket(null)}>
                Close
              </Button>
              {isAdmin && isAssignedToMe && (
                <Button color="primary" onClick={saveTicket} disabled={saving}>
                  {saving ? <Spinner size="sm" /> : "Save changes"}
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
