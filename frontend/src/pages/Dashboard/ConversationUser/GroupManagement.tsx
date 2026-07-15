import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Input, Spinner } from "reactstrap";
import {
  addConversationParticipant,
  getConversationParticipants,
  getUsers,
  removeConversationParticipant,
} from "../../../api/chats";
import { getCurrentAuthUser } from "../../../api/backendAdapters";

interface GroupManagementProps {
  conversationId: string | number;
  onChanged: () => void;
}

const GroupManagement = ({
  conversationId,
  onChanged,
}: GroupManagementProps) => {
  const [participants, setParticipants] = useState<Array<any>>([]);
  const [users, setUsers] = useState<Array<any>>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const currentUser = getCurrentAuthUser();

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
  }, [load]);

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
      {error && (
        <Alert color="danger" className="py-1 px-2 mt-2 mb-0 font-size-12">
          {error}
        </Alert>
      )}
    </div>
  );
};

export default GroupManagement;
