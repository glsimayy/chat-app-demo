import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Input, Label, Spinner } from "reactstrap";
import {
  addConversationParticipant,
  getConversationParticipants,
  getUsers,
  leaveConversation,
  removeConversationParticipant,
  transferConversationOwner,
  updateGroupConversation,
} from "../../../api/chats";
import { getCurrentAuthUser } from "../../../api/backendAdapters";

interface GroupManagementProps {
  conversationId: string | number;
  conversationName: string;
  participantStateKey: string;
  onChanged: () => void;
  onLeft: () => void;
}

const GroupManagement = ({
  conversationId,
  conversationName,
  participantStateKey,
  onChanged,
  onLeft,
}: GroupManagementProps) => {
  const [participants, setParticipants] = useState<Array<any>>([]);
  const [users, setUsers] = useState<Array<any>>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [groupName, setGroupName] = useState(conversationName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const currentUser = getCurrentAuthUser();

  useEffect(() => {
    setGroupName(conversationName);
  }, [conversationName]);

  const load = useCallback(async () => {
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
  const availableUsers = users.filter(user => !activeUserIds.has(user.id));
  const canManage =
    currentUser?.role === "admin" ||
    participants.some(
      participant =>
        participant.userId === currentUser?.id && participant.role === "owner",
    );
  const currentParticipant = participants.find(
    participant => participant.userId === currentUser?.id,
  );
  const isOwner = currentParticipant?.role === "owner";
  const ownerCandidates = participants.filter(
    participant => participant.role !== "owner",
  );

  const userLabel = (userId: string) => {
    const user = users.find(item => item.id === userId);
    return user?.username || user?.email || userId;
  };

  const addParticipant = async () => {
    if (!selectedUserId) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      await addConversationParticipant(conversationId, selectedUserId);
      setSelectedUserId("");
      await load();
      onChanged();
    } catch (addError: any) {
      setError(String(addError || "Member could not be added"));
    } finally {
      setLoading(false);
    }
  };

  const removeParticipant = async (userId: string) => {
    try {
      setLoading(true);
      setError("");
      await removeConversationParticipant(conversationId, userId);
      await load();
      onChanged();
    } catch (removeError: any) {
      setError(String(removeError || "Member could not be removed"));
    } finally {
      setLoading(false);
    }
  };

  const renameGroup = async () => {
    const name = groupName.trim();

    if (!name || name === conversationName) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      setNotice("");
      await updateGroupConversation(conversationId, name);
      setNotice("Group name updated");
      onChanged();
    } catch (renameError: any) {
      setError(String(renameError || "Group name could not be updated"));
    } finally {
      setLoading(false);
    }
  };

  const transferOwner = async () => {
    if (!ownerUserId) {
      return;
    }

    if (!window.confirm(`Transfer ownership to ${userLabel(ownerUserId)}?`)) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      setNotice("");
      await transferConversationOwner(conversationId, ownerUserId);
      setOwnerUserId("");
      await load();
      setNotice("Group ownership transferred");
      onChanged();
    } catch (transferError: any) {
      setError(String(transferError || "Ownership could not be transferred"));
    } finally {
      setLoading(false);
    }
  };

  const leaveGroup = async () => {
    if (isOwner || !currentParticipant) {
      return;
    }

    if (!window.confirm("Leave this group?")) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      setNotice("");
      await leaveConversation(conversationId);
      onLeft();
    } catch (leaveError: any) {
      setError(String(leaveError || "Group could not be left"));
      setLoading(false);
    }
  };

  return (
    <div className="border-bottom bg-light px-3 py-2">
      <div className="d-flex flex-wrap align-items-center gap-2">
        <span className="text-muted font-size-12">Members</span>
        {participants.map(participant => (
          <Badge
            color={participant.role === "owner" ? "primary" : "secondary"}
            className="d-inline-flex align-items-center gap-1"
            key={participant.userId}
          >
            {userLabel(participant.userId)}
            {canManage && participant.role !== "owner" && (
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
        ))}

        {canManage && availableUsers.length > 0 && (
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
                <i className="bx bx-user-plus" aria-hidden="true"></i>
              )}
            </Button>
          </div>
        )}
      </div>
      <div className="row g-2 align-items-end mt-1">
        {canManage && (
          <div className="col-12 col-xl-5">
            <Label
              className="form-label font-size-11 text-muted mb-1"
              htmlFor="group-name-input"
            >
              Group name
            </Label>
            <div className="input-group input-group-sm">
              <Input
                id="group-name-input"
                value={groupName}
                disabled={loading}
                maxLength={80}
                onChange={event => setGroupName(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter") {
                    renameGroup();
                  }
                }}
              />
              <Button
                color="primary"
                title="Save group name"
                aria-label="Save group name"
                disabled={
                  loading ||
                  !groupName.trim() ||
                  groupName.trim() === conversationName
                }
                onClick={renameGroup}
              >
                <i className="bx bx-check" aria-hidden="true"></i>
              </Button>
            </div>
          </div>
        )}

        {canManage && ownerCandidates.length > 0 && (
          <div className="col-12 col-xl-5">
            <Label
              className="form-label font-size-11 text-muted mb-1"
              htmlFor="group-owner-input"
            >
              Transfer ownership
            </Label>
            <div className="input-group input-group-sm">
              <Input
                id="group-owner-input"
                type="select"
                value={ownerUserId}
                disabled={loading}
                onChange={event => setOwnerUserId(event.target.value)}
              >
                <option value="">Select member...</option>
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
          </div>
        )}

        {currentParticipant && (
          <div className="col-12 col-xl-2 d-grid">
            <Button
              size="sm"
              outline
              color="danger"
              title={
                isOwner ? "Transfer ownership before leaving" : "Leave group"
              }
              disabled={loading || isOwner}
              onClick={leaveGroup}
            >
              <i className="bx bx-log-out me-1" aria-hidden="true"></i>
              Leave group
            </Button>
            {isOwner && (
              <small className="text-muted mt-1">
                Transfer ownership before leaving.
              </small>
            )}
          </div>
        )}
      </div>
      {error && (
        <Alert color="danger" className="py-1 px-2 mt-2 mb-0 font-size-12">
          {error}
        </Alert>
      )}
      {notice && (
        <Alert color="success" className="py-1 px-2 mt-2 mb-0 font-size-12">
          {notice}
        </Alert>
      )}
    </div>
  );
};

export default GroupManagement;
