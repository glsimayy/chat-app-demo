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
}

const GroupManagement = ({
  conversation,
  participantStateKey,
  onChanged,
  onLeft,
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
        getUsers(),
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

  const userLabel = (userId: string) => {
    const user = users.find(item => item.id === userId);
    return user?.username || user?.email || userId;
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
    } catch (actionError: any) {
      setError(String(actionError || "Group could not be updated"));
    } finally {
      setLoading(false);
    }
  };

  const addParticipant = () => {
    if (!selectedUserId) {
      return;
    }

    runAction(
      () => addConversationParticipant(conversationId, selectedUserId),
      "Member added",
    ).then(() => setSelectedUserId(""));
  };

  const removeParticipant = (userId: string) =>
    runAction(
      () => removeConversationParticipant(conversationId, userId),
      "Member removed",
    );

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

  return (
    <div className="border-bottom bg-light px-3 py-2">
      {error && (
        <Alert color="danger" className="py-1 px-2 mb-2">
          {error}
        </Alert>
      )}
      {notice && (
        <Alert color="success" className="py-1 px-2 mb-2">
          {notice}
        </Alert>
      )}

      <div className="d-flex flex-wrap align-items-center gap-2">
        <span className="text-muted font-size-12">Members</span>
        {participants.map(participant => {
          const bot = isBotUser(participant.userId);
          const canRemove =
            canManageMembers &&
            participant.role !== "owner" &&
            !bot &&
            (!isManager || participant.role === "member") &&
            (!isGlobalAdminUser(participant.userId) || isGlobalAdmin);

          return (
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
              className="d-inline-flex align-items-center gap-1"
              key={participant.userId}
            >
              {bot && <i className="bx bx-bot" aria-hidden="true"></i>}
              {userLabel(participant.userId)}
              {participant.role !== "member" && ` | ${participant.role}`}
              {canChangeSettings && participant.role !== "owner" && !bot && (
                <button
                  type="button"
                  className="btn btn-link p-0 text-white lh-1"
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
                </button>
              )}
              {canRemove && (
                <button
                  type="button"
                  className="btn btn-link p-0 text-white lh-1"
                  title="Remove member"
                  aria-label={`Remove ${userLabel(participant.userId)}`}
                  disabled={loading}
                  onClick={() => removeParticipant(participant.userId)}
                >
                  <i className="bx bx-x" aria-hidden="true"></i>
                </button>
              )}
            </Badge>
          );
        })}

        {canManageMembers && availableUsers.length > 0 && (
          <div className="d-flex align-items-center gap-1 ms-lg-auto">
            <Input
              bsSize="sm"
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
              size="sm"
              color="primary"
                  title="Add member"
                  aria-label="Add selected member"
              disabled={!selectedUserId || loading}
              onClick={addParticipant}
            >
              {loading ? (
                <Spinner size="sm" />
              ) : (
                <i className="bx bx-user-plus"></i>
              )}
            </Button>
          </div>
        )}
      </div>

      {(canManageMembers || currentParticipant) && (
        <div className="row g-2 align-items-end mt-1">
          {canManageMembers && (
            <>
              <div className="col-12 col-xl-3">
                <Label
                  className="form-label font-size-11 text-muted mb-1"
                  htmlFor="group-name-input"
                >
                  Group name
                </Label>
                <Input
                  bsSize="sm"
                  id="group-name-input"
                  value={groupName}
                  disabled={loading}
                  maxLength={80}
                  onChange={event => setGroupName(event.target.value)}
                />
              </div>
              <div className="col-12 col-xl-4">
                <Label
                  className="form-label font-size-11 text-muted mb-1"
                  htmlFor="group-description-input"
                >
                  Description
                </Label>
                <Input
                  bsSize="sm"
                  id="group-description-input"
                  value={description}
                  disabled={loading}
                  maxLength={300}
                  onChange={event => setDescription(event.target.value)}
                />
              </div>
              <div className="col-auto">
                <Button
                  size="sm"
                  color="primary"
                  title="Save group details"
                  aria-label="Save group details"
                  disabled={loading || groupName.trim().length < 3}
                  onClick={saveGroupDetails}
                >
                  <i className="bx bx-check" aria-hidden="true"></i>
                </Button>
              </div>
            </>
          )}

          {canChangeSettings && (
            <>
              <div className="col-auto form-check form-switch ms-2 mb-1">
                <Input
                  type="switch"
                  id="group-message-policy"
                  checked={memberCanSendMessages}
                  onChange={event =>
                    setMemberCanSendMessages(event.target.checked)
                  }
                />
                <Label
                  className="form-check-label font-size-12"
                  htmlFor="group-message-policy"
                >
                  Members can message
                </Label>
              </div>
              <div className="col-auto form-check form-switch ms-2 mb-1">
                <Input
                  type="switch"
                  id="group-leave-policy"
                  checked={membersCanLeave}
                  onChange={event => setMembersCanLeave(event.target.checked)}
                />
                <Label
                  className="form-check-label font-size-12"
                  htmlFor="group-leave-policy"
                >
                  Members can leave
                </Label>
              </div>
              <div className="col-auto">
                <Input
                  bsSize="sm"
                  type="select"
                  aria-label="Group status"
                  value={status}
                  onChange={event => setStatus(event.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
                  <option value="archived">Archived</option>
                </Input>
              </div>
              <div className="col-auto">
                <Button
                  size="sm"
                  outline
                  color="primary"
                  disabled={loading}
                  onClick={saveGroupPolicies}
                >
                  Save policies
                </Button>
              </div>
            </>
          )}

          {canChangeSettings && ownerCandidates.length > 0 && (
            <div className="col-12 col-xl-3">
              <div className="input-group input-group-sm">
                <Input
                  type="select"
                  id="group-owner-input"
                  aria-label="Transfer ownership"
                  value={ownerUserId}
                  disabled={loading}
                  onChange={event => setOwnerUserId(event.target.value)}
                >
                  <option value="">Transfer ownership...</option>
                  {ownerCandidates.map(participant => (
                    <option value={participant.userId} key={participant.userId}>
                      {userLabel(participant.userId)}
                    </option>
                  ))}
                </Input>
                <Button
                  color="primary"
                  aria-label="Transfer ownership"
                  disabled={!ownerUserId || loading}
                  onClick={transferOwner}
                >
                  <i className="bx bx-transfer" aria-hidden="true"></i>
                </Button>
              </div>
            </div>
          )}

          {currentParticipant && (
            <div className="col-auto">
              <Button
                size="sm"
                outline
                color="danger"
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
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GroupManagement;
