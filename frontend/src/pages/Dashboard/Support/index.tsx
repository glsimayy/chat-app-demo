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
import AppSimpleBar from "../../../components/AppSimpleBar";
import LeftbarTitle from "../../../components/LeftbarTitle";
import {
  createSupportTicket,
  getSupportTickets,
  SupportTicket,
  SupportTicketPriority,
  SupportTicketStatus,
  updateSupportTicket,
} from "../../../api/tickets";
import { getCurrentAuthUser } from "../../../api/backendAdapters";
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

const Support = () => {
  const currentUser = getCurrentAuthUser();
  const isAdmin = currentUser?.role === "admin";
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<SupportTicketPriority>("medium");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(
    null,
  );
  const [editStatus, setEditStatus] = useState<SupportTicketStatus>("open");
  const [editPriority, setEditPriority] =
    useState<SupportTicketPriority>("medium");
  const [adminNote, setAdminNote] = useState("");
  const [saving, setSaving] = useState(false);

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
        search: search.trim() || undefined,
      });
      setTickets(response.items || []);
    } catch (requestError: any) {
      setError(String(requestError || "Support tickets could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [priorityFilter, search, statusFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(loadTickets, search ? 250 : 0);
    return () => window.clearTimeout(timeout);
  }, [loadTickets, search]);

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

  const openTicket = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setEditStatus(ticket.status);
    setEditPriority(ticket.priority);
    setAdminNote(ticket.adminNote || "");
  };

  const saveTicket = async () => {
    if (!selectedTicket || !isAdmin) {
      return;
    }

    setSaving(true);
    try {
      const updated = await updateSupportTicket(selectedTicket.id, {
        status: editStatus,
        priority: editPriority,
        adminNote,
      });
      setSelectedTicket(updated);
      showSuccessNotification("Support ticket updated.");
      await loadTickets();
    } catch (requestError: any) {
      showErrorNotification(
        String(requestError || "Support ticket could not be updated."),
      );
    } finally {
      setSaving(false);
    }
  };

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
                {isAdmin ? "Incoming Requests" : "My Requests"}
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
                <span>No support requests yet.</span>
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
                <Form>
                  <div className="row g-3">
                    <FormGroup className="col-sm-6 mb-0">
                      <Label for="ticket-status">Status</Label>
                      <Input
                        id="ticket-status"
                        type="select"
                        value={editStatus}
                        onChange={event =>
                          setEditStatus(
                            event.target.value as SupportTicketStatus,
                          )
                        }
                      >
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Input>
                    </FormGroup>
                    <FormGroup className="col-sm-6 mb-0">
                      <Label for="ticket-edit-priority">Priority</Label>
                      <Input
                        id="ticket-edit-priority"
                        type="select"
                        value={editPriority}
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
                    <Label for="ticket-admin-note">Admin note</Label>
                    <Input
                      id="ticket-admin-note"
                      type="textarea"
                      rows={4}
                      maxLength={2000}
                      value={adminNote}
                      onChange={event => setAdminNote(event.target.value)}
                      placeholder="Add a response or resolution note"
                    />
                  </FormGroup>
                </Form>
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
              {isAdmin && (
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
