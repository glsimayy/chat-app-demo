import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Input, Label, Spinner } from "reactstrap";
import {
  addConversationParticipant,
  getConversationParticipants,
  getUsers,
  leaveConversation,
  removeConversationParticipant,
  transferConversationOwner,
  updateConversationParticipantRole,
  updateGroupConversation,
} from "../../../api/chats";
import { getCurrentAuthUser } from "../../../api/backendAdapters";

interface GroupManagementProps {
  conversation: any;
  participantStateKey: string;
  onChanged: () => void;
  onLeft: () => void;
  onOpenDirect: (userId: string) => Promise<void>;
}

const GroupManagement = ({
  conversation,
  participantStateKey,
  onChanged,
  onLeft,
  onOpenDirect,
}: GroupManagementProps) => {
  const conversationId = conversation.id;
  const [participants, setParticipants] = useState<Array<any>>([]);
  const [users, setUsers] = useState<Array<any>>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [groupName, setGroupName] = useState(conversation.name || "");
  const [description, setDescription] = useState(
    conversation.description || "",
  );
  const [memberCanSendMessages, setMemberCanSendMessages] = useState(false);
  const [membersCanLeave, setMembersCanLeave] = useState(true);
  const [status, setStatus] = useState("active");
  const [loading, setLoading] = useState(false);
  const [openingUserId, setOpeningUserId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const currentUser = getCurrentAuthUser();

  useEffect(() => {
    setGroupName(conversation.name || "");
    setDescription(conversation.description || "");
    setMemberCanSendMessages(Boolean(conversation.memberCanSendMessages));
    setMembersCanLeave(conversation.membersCanLeave !== false);
    setStatus(conversation.status || "active");
  }, [conversation]);

  const load = useCallback(async () => {
    if (!conversationId) {
      return;
    }

    try {
      setError("");
      const [nextParticipants, nextUsers] = await Promise.all([
        getConversationParticipants(conversationId),
        getUsers(true),
      ]);
      setParticipants(nextParticipants.filter((item: any) => !item.leftAt));
      setUsers(nextUsers);
    } catch (loadError: any) {
      setError(String(loadError || "Group members could not be loaded"));
    }
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load, participantStateKey]);

  const activeUserIds = useMemo(
    () => new Set(participants.map(participant => participant.userId)),
    [participants],
  );
  const availableUsers = users.filter(
    user => !user.isBot && !activeUserIds.has(user.id),
  );
  const currentParticipant = participants.find(
    participant => participant.userId === currentUser?.id,
  );
  const owner = participants.find(participant => participant.role === "owner");
  const isGlobalAdmin = currentUser?.role === "admin";
  const isOwner = currentParticipant?.role === "owner";
  const isManager = currentParticipant?.role === "manager";
  const canManageMembers = isGlobalAdmin || isOwner || isManager;
  const canChangeSettings = isGlobalAdmin || isOwner;
  const isBotUser = (userId: string) =>
    Boolean(users.find(user => user.id === userId)?.isBot);
  const isGlobalAdminUser = (userId: string) =>
    users.find(user => user.id === userId)?.role === "admin";
  const ownerCandidates = conversation.isBotManaged
    ? []
    : participants.filter(
        participant =>
          participant.role !== "owner" && !isBotUser(participant.userId),
      );

  const getUser = (userId: string) =>
    users.find(item => item.id === userId) || {
      id: userId,
      username: "Unknown user",
      email: userId,
    };

  const userLabel = (userId: string) => {
    const user = getUser(userId);
    return user.username || user.email || userId;
  };

  const initials = (userId: string) => {
    const label = userLabel(userId);
    const parts = label.split(/[\s._-]+/).filter(Boolean);
    return `${parts[0]?.charAt(0) || "U"}${parts[1]?.charAt(0) || ""}`.toUpperCase();
  };

  const avatarTone = (userId: string) => {
    const tones = ["primary", "success", "warning", "info", "danger"];
    const score = Array.from(userId).reduce(
      (total, character) => total + character.charCodeAt(0),
      0,
    );
    return tones[score % tones.length];
  };

  const runAction = async (
    action: () => Promise<unknown>,
    success?: string,
  ) => {
    try {
      setLoading(true);
      setError("");
      setNotice("");
      await action();
      await load();
      if (success) {
        setNotice(success);
      }
      onChanged();
      return true;
    } catch (actionError: any) {
      setError(String(actionError || "Group could not be updated"));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const addParticipant = async () => {
    if (!selectedUserId) {
      return;
    }

    const succeeded = await runAction(
      () => addConversationParticipant(conversationId, selectedUserId),
      "Member added",
    );
    if (succeeded) {
      setSelectedUserId("");
    }
  };

  const removeParticipant = async (userId: string) => {
    if (!window.confirm(`Remove ${userLabel(userId)} from this group?`)) {
      return;
    }

    await runAction(
      () => removeConversationParticipant(conversationId, userId),
      "Member removed",
    );
  };

  const saveGroupDetails = () =>
    runAction(
      () =>
        updateGroupConversation(conversationId, {
          name: groupName.trim(),
          description: description.trim(),
        }),
      "Group details updated",
    );

  const saveGroupPolicies = () =>
    runAction(
      () =>
        updateGroupConversation(conversationId, {
          memberCanSendMessages,
          membersCanLeave,
          status,
        }),
      "Group policies updated",
    );

  const toggleManager = (participant: any) =>
    runAction(
      () =>
        updateConversationParticipantRole(
          conversationId,
          participant.userId,
          participant.role === "manager" ? "member" : "manager",
        ),
      participant.role === "manager" ? "Manager removed" : "Manager assigned",
    );

  const transferOwner = async () => {
    if (!ownerUserId) {
      return;
    }

    if (!window.confirm(`Transfer ownership to ${userLabel(ownerUserId)}?`)) {
      return;
    }

    await runAction(
      () => transferConversationOwner(conversationId, ownerUserId),
      "Group ownership transferred",
    );
    setOwnerUserId("");
  };

  const leaveGroup = async () => {
    if (isOwner || !currentParticipant || !conversation.membersCanLeave) {
      return;
    }

    if (!window.confirm("Leave this group?")) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      await leaveConversation(conversationId);
      onLeft();
    } catch (leaveError: any) {
      setError(String(leaveError || "Group could not be left"));
      setLoading(false);
    }
  };

  const openDirectChat = async (userId: string) => {
    try {
      setOpeningUserId(userId);
      setError("");
      await onOpenDirect(userId);
    } catch (openError: any) {
      setError(String(openError || "Direct conversation could not be opened"));
    } finally {
      setOpeningUserId("");
    }
  };

  return (
    <div className="group-info-management">
      {error && (
        <Alert color="danger" className="py-2 px-3 mb-3 font-size-12">
          {error}
        </Alert>
      )}
      {notice && (
        <Alert color="success" className="py-2 px-3 mb-3 font-size-12">
          {notice}
        </Alert>
      )}

      <section
        className="group-info-section"
        aria-labelledby="group-overview-heading"
      >
        <h5 id="group-overview-heading" className="group-info-heading">
          Group overview
        </h5>
        <dl className="group-info-facts mb-0">
          <div>
            <dt>Ownership</dt>
            <dd>
              {conversation.isBotManaged ? (
                <Badge color="info">BOT managed</Badge>
              ) : owner ? (
                <span>{userLabel(owner.userId)}</span>
              ) : (
                <span className="text-warning">No human owner</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <Badge
                color={
                  status === "active"
                    ? "success"
                    : status === "closed"
                      ? "warning"
                      : "secondary"
                }
              >
                {status}
              </Badge>
            </dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>
              {conversation.sourceName ||
                (conversation.isBotManaged ? "Automation" : "Manual")}
            </dd>
          </div>
          <div>
            <dt>Messaging</dt>
            <dd>
              {conversation.memberCanSendMessages
                ? "All members"
                : "Management only"}
            </dd>
          </div>
          <div>
            <dt>Leaving</dt>
            <dd>
              {conversation.membersCanLeave
                ? "Members may leave"
                : "Restricted"}
            </dd>
          </div>
        </dl>
      </section>

      {canManageMembers && (
        <section
          className="group-info-section"
          aria-labelledby="group-details-heading"
        >
          <h5 id="group-details-heading" className="group-info-heading">
            Details
          </h5>
          <div className="mb-3">
            <Label
              className="form-label font-size-12"
              htmlFor="group-name-input"
            >
              Group name
            </Label>
            <Input
              id="group-name-input"
              value={groupName}
              disabled={loading}
              maxLength={80}
              onChange={event => setGroupName(event.target.value)}
            />
          </div>
          <div className="mb-3">
            <Label
              className="form-label font-size-12"
              htmlFor="group-description-input"
            >
              Description
            </Label>
            <Input
              id="group-description-input"
              type="textarea"
              rows={3}
              value={description}
              disabled={loading}
              maxLength={300}
              onChange={event => setDescription(event.target.value)}
            />
          </div>
          <Button
            color="primary"
            className="w-100"
            aria-label="Save group details"
            disabled={loading || groupName.trim().length < 3}
            onClick={saveGroupDetails}
          >
            <i className="bx bx-save me-1" aria-hidden="true"></i>
            Save group details
          </Button>
        </section>
      )}

      <section
        className="group-info-section"
        aria-labelledby="group-members-heading"
      >
        <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
          <h5 id="group-members-heading" className="group-info-heading mb-0">
            Members
          </h5>
          <Badge color="light" className="text-body">
            {participants.length}
          </Badge>
        </div>

        <ul className="group-member-list list-unstyled mb-0">
          {participants.map(participant => {
            const user = getUser(participant.userId);
            const bot = Boolean(user.isBot);
            const isCurrentUser = participant.userId === currentUser?.id;
            const canOpenDirect = !bot && !isCurrentUser;
            const canRemove =
              canManageMembers &&
              !isCurrentUser &&
              participant.role !== "owner" &&
              !bot &&
              (!isManager || participant.role === "member") &&
              (!isGlobalAdminUser(participant.userId) || isGlobalAdmin);

            return (
              <li className="group-member-row" key={participant.userId}>
                <button
                  type="button"
                  className="group-member-main"
                  title={
                    canOpenDirect
                      ? `Message ${userLabel(participant.userId)}`
                      : undefined
                  }
                  aria-label={
                    canOpenDirect
                      ? `Message ${userLabel(participant.userId)}`
                      : undefined
                  }
                  disabled={
                    !canOpenDirect || openingUserId === participant.userId
                  }
                  onClick={() => openDirectChat(participant.userId)}
                >
                  <span
                    className={`avatar-xs avatar-title rounded-circle bg-${avatarTone(participant.userId)} text-white`}
                  >
                    {bot ? (
                      <i className="bx bx-bot" aria-hidden="true"></i>
                    ) : (
                      initials(participant.userId)
                    )}
                  </span>
                  <span className="group-member-copy">
                    <strong>{userLabel(participant.userId)}</strong>
                    <small>
                      {user.email ||
                        (bot ? "Automation account" : "Group member")}
                    </small>
                  </span>
                  {openingUserId === participant.userId && (
                    <Spinner size="sm" />
                  )}
                </button>
                <div className="group-member-meta">
                  <Badge
                    color={
                      bot
                        ? "info"
                        : participant.role === "owner"
                          ? "primary"
                          : participant.role === "manager"
                            ? "success"
                            : "secondary"
                    }
                  >
                    {bot ? "BOT" : participant.role}
                  </Badge>
                  {user.role === "admin" && !bot && (
                    <Badge color="light" className="text-body">
                      global admin
                    </Badge>
                  )}
                  {canChangeSettings &&
                    participant.role !== "owner" &&
                    !bot && (
                      <Button
                        color="light"
                        size="sm"
                        title={
                          participant.role === "manager"
                            ? "Remove manager role"
                            : "Make manager"
                        }
                        aria-label={
                          participant.role === "manager"
                            ? `Remove manager role from ${userLabel(participant.userId)}`
                            : `Make ${userLabel(participant.userId)} manager`
                        }
                        disabled={loading}
                        onClick={() => toggleManager(participant)}
                      >
                        <i
                          className={
                            participant.role === "manager"
                              ? "bx bx-user-minus"
                              : "bx bx-user-check"
                          }
                          aria-hidden="true"
                        ></i>
                      </Button>
                    )}
                  {canRemove && (
                    <Button
                      color="light"
                      size="sm"
                      className="text-danger"
                      title="Remove member"
                      aria-label={`Remove ${userLabel(participant.userId)}`}
                      disabled={loading}
                      onClick={() => removeParticipant(participant.userId)}
                    >
                      <i className="bx bx-user-x" aria-hidden="true"></i>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {canManageMembers && availableUsers.length > 0 && (
          <div className="input-group mt-3">
            <Input
              type="select"
              aria-label="Select member to add"
              value={selectedUserId}
              disabled={loading}
              onChange={event => setSelectedUserId(event.target.value)}
            >
              <option value="">Add member...</option>
              {availableUsers.map(user => (
                <option value={user.id} key={user.id}>
                  {user.username || user.email}
                </option>
              ))}
            </Input>
            <Button
              color="primary"
              title="Add member"
              aria-label="Add selected member"
              disabled={!selectedUserId || loading}
              onClick={addParticipant}
            >
              {loading ? (
                <Spinner size="sm" />
              ) : (
                <i className="bx bx-user-plus" aria-hidden="true"></i>
              )}
            </Button>
          </div>
        )}
      </section>

      {canChangeSettings && (
        <section
          className="group-info-section"
          aria-labelledby="group-policies-heading"
        >
          <h5 id="group-policies-heading" className="group-info-heading">
            Policies
          </h5>
          <div className="form-check form-switch mb-3">
            <Input
              type="switch"
              id="group-message-policy"
              checked={memberCanSendMessages}
              disabled={loading}
              onChange={event => setMemberCanSendMessages(event.target.checked)}
            />
            <Label className="form-check-label" htmlFor="group-message-policy">
              Members can message
            </Label>
          </div>
          <div className="form-check form-switch mb-3">
            <Input
              type="switch"
              id="group-leave-policy"
              checked={membersCanLeave}
              disabled={loading}
              onChange={event => setMembersCanLeave(event.target.checked)}
            />
            <Label className="form-check-label" htmlFor="group-leave-policy">
              Members can leave
            </Label>
          </div>
          <Label
            className="form-label font-size-12"
            htmlFor="group-status-input"
          >
            Group status
          </Label>
          <Input
            id="group-status-input"
            type="select"
            aria-label="Group status"
            value={status}
            disabled={loading}
            onChange={event => setStatus(event.target.value)}
          >
            <option value="active">Active</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </Input>
          <Button
            color="primary"
            outline
            className="w-100 mt-3"
            disabled={loading}
            onClick={saveGroupPolicies}
          >
            <i className="bx bx-shield-quarter me-1" aria-hidden="true"></i>
            Save policies
          </Button>
        </section>
      )}

      {canChangeSettings && ownerCandidates.length > 0 && (
        <section
          className="group-info-section"
          aria-labelledby="group-ownership-heading"
        >
          <h5 id="group-ownership-heading" className="group-info-heading">
            Ownership
          </h5>
          <div className="input-group">
            <Input
              type="select"
              id="group-owner-input"
              aria-label="Transfer ownership"
              value={ownerUserId}
              disabled={loading}
              onChange={event => setOwnerUserId(event.target.value)}
            >
              <option value="">Select new owner...</option>
              {ownerCandidates.map(participant => (
                <option value={participant.userId} key={participant.userId}>
                  {userLabel(participant.userId)}
                </option>
              ))}
            </Input>
            <Button
              color="primary"
              title="Transfer ownership"
              aria-label="Transfer ownership"
              disabled={!ownerUserId || loading}
              onClick={transferOwner}
            >
              <i className="bx bx-transfer" aria-hidden="true"></i>
            </Button>
          </div>
        </section>
      )}

      {currentParticipant && (
        <section
          className="group-info-section group-info-membership"
          aria-labelledby="group-membership-heading"
        >
          <h5 id="group-membership-heading" className="group-info-heading">
            Your membership
          </h5>
          <p className="text-muted font-size-12">
            You are a <strong>{currentParticipant.role}</strong> in this group.
          </p>
          <Button
            outline
            color="danger"
            className="w-100"
            title={
              isOwner
                ? "Transfer ownership before leaving"
                : !conversation.membersCanLeave
                  ? "Members cannot leave this group"
                  : "Leave group"
            }
            disabled={loading || isOwner || !conversation.membersCanLeave}
            onClick={leaveGroup}
          >
            <i className="bx bx-log-out me-1" aria-hidden="true"></i>
            Leave group
          </Button>
        </section>
      )}
    </div>
  );
};

export default GroupManagement;
