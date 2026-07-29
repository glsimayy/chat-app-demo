import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      setError(String(loadError || t("groupManagement.membersLoadFailed")));
    }
  }, [conversationId, t]);

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
      username: t("groupManagement.unknownUser"),
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
      setError(String(actionError || t("groupManagement.updateFailed")));
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
      t("groupManagement.memberAdded"),
    );
    if (succeeded) {
      setSelectedUserId("");
    }
  };

  const removeParticipant = async (userId: string) => {
    if (
      !window.confirm(
        t("groupManagement.confirmRemove", { name: userLabel(userId) }),
      )
    ) {
      return;
    }

    await runAction(
      () => removeConversationParticipant(conversationId, userId),
      t("groupManagement.memberRemoved"),
    );
  };

  const saveGroupDetails = () =>
    runAction(
      () =>
        updateGroupConversation(conversationId, {
          name: groupName.trim(),
          description: description.trim(),
        }),
      t("groupManagement.detailsUpdated"),
    );

  const updateMessagePolicy = async (enabled: boolean) => {
    const previousValue = memberCanSendMessages;
    setMemberCanSendMessages(enabled);

    const succeeded = await runAction(
      () =>
        updateGroupConversation(conversationId, {
          memberCanSendMessages: enabled,
        }),
      enabled
        ? t("groupManagement.membersCanSend")
        : t("groupManagement.memberMessagingDisabled"),
    );

    if (!succeeded) {
      setMemberCanSendMessages(previousValue);
    }
  };

  const updateLeavePolicy = async (enabled: boolean) => {
    const previousValue = membersCanLeave;
    setMembersCanLeave(enabled);

    const succeeded = await runAction(
      () =>
        updateGroupConversation(conversationId, {
          membersCanLeave: enabled,
        }),
      enabled
        ? t("groupManagement.membersCanLeave")
        : t("groupManagement.memberLeavingDisabled"),
    );

    if (!succeeded) {
      setMembersCanLeave(previousValue);
    }
  };

  const updateGroupStatus = async (nextStatus: string) => {
    const previousValue = status;
    setStatus(nextStatus);

    const succeeded = await runAction(
      () =>
        updateGroupConversation(conversationId, {
          status: nextStatus,
        }),
      t("groupManagement.statusUpdated"),
    );

    if (!succeeded) {
      setStatus(previousValue);
    }
  };

  const toggleManager = (participant: any) =>
    runAction(
      () =>
        updateConversationParticipantRole(
          conversationId,
          participant.userId,
          participant.role === "manager" ? "member" : "manager",
        ),
      participant.role === "manager"
        ? t("groupManagement.managerRemoved")
        : t("groupManagement.managerAssigned"),
    );

  const transferOwner = async () => {
    if (!ownerUserId) {
      return;
    }

    if (
      !window.confirm(
        t("groupManagement.confirmTransfer", {
          name: userLabel(ownerUserId),
        }),
      )
    ) {
      return;
    }

    await runAction(
      () => transferConversationOwner(conversationId, ownerUserId),
      t("groupManagement.ownershipTransferred"),
    );
    setOwnerUserId("");
  };

  const leaveGroup = async () => {
    if (isOwner || !currentParticipant || !conversation.membersCanLeave) {
      return;
    }

    if (!window.confirm(t("groupManagement.confirmLeave"))) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      await leaveConversation(conversationId);
      onLeft();
    } catch (leaveError: any) {
      setError(String(leaveError || t("groupManagement.leaveFailed")));
      setLoading(false);
    }
  };

  const openDirectChat = async (userId: string) => {
    try {
      setOpeningUserId(userId);
      setError("");
      await onOpenDirect(userId);
    } catch (openError: any) {
      setError(String(openError || t("groupManagement.directFailed")));
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
          {t("groupManagement.overview")}
        </h5>
        <dl className="group-info-facts mb-0">
          <div>
            <dt>{t("groupManagement.ownership")}</dt>
            <dd>
              {conversation.isBotManaged ? (
                <Badge color="info">{t("groupManagement.botManaged")}</Badge>
              ) : owner ? (
                <span>{userLabel(owner.userId)}</span>
              ) : (
                <span className="text-warning">
                  {t("groupManagement.noHumanOwner")}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>{t("groupManagement.status")}</dt>
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
                {t(`groupManagement.${status}`)}
              </Badge>
            </dd>
          </div>
          <div>
            <dt>{t("groupManagement.source")}</dt>
            <dd>
              {conversation.sourceName ||
                (conversation.isBotManaged
                  ? t("groupManagement.automation")
                  : t("groupManagement.manual"))}
            </dd>
          </div>
          <div>
            <dt>{t("groupManagement.messaging")}</dt>
            <dd>
              {conversation.memberCanSendMessages
                ? t("groupManagement.allMembers")
                : t("groupManagement.managementOnly")}
            </dd>
          </div>
          <div>
            <dt>{t("groupManagement.leaving")}</dt>
            <dd>
              {conversation.membersCanLeave
                ? t("groupManagement.membersMayLeave")
                : t("groupManagement.restricted")}
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
            {t("groupManagement.details")}
          </h5>
          <div className="mb-3">
            <Label
              className="form-label font-size-12"
              htmlFor="group-name-input"
            >
              {t("groupManagement.groupName")}
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
              {t("groupManagement.description")}
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
            aria-label={t("groupManagement.saveDetails")}
            disabled={loading || groupName.trim().length < 3}
            onClick={saveGroupDetails}
          >
            <i className="bx bx-save me-1" aria-hidden="true"></i>
            {t("groupManagement.saveDetails")}
          </Button>
        </section>
      )}

      <section
        className="group-info-section"
        aria-labelledby="group-members-heading"
      >
        <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
          <h5 id="group-members-heading" className="group-info-heading mb-0">
            {t("groupManagement.members")}
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
                      ? t("groupManagement.messageUser", {
                          name: userLabel(participant.userId),
                        })
                      : undefined
                  }
                  aria-label={
                    canOpenDirect
                      ? t("groupManagement.messageUser", {
                          name: userLabel(participant.userId),
                        })
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
                        (bot
                          ? t("groupManagement.automationAccount")
                          : t("groupManagement.groupMember"))}
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
                    {bot
                      ? "BOT"
                      : t(`groupManagement.role.${participant.role}`)}
                  </Badge>
                  {user.role === "admin" && !bot && (
                    <Badge color="light" className="text-body">
                      {t("groupManagement.globalAdmin")}
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
                            ? t("groupManagement.removeManagerRole")
                            : t("groupManagement.makeManager")
                        }
                        aria-label={
                          participant.role === "manager"
                            ? t("groupManagement.removeManagerFrom", {
                                name: userLabel(participant.userId),
                              })
                            : t("groupManagement.makeUserManager", {
                                name: userLabel(participant.userId),
                              })
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
                      title={t("groupManagement.removeMember")}
                      aria-label={t("groupManagement.removeUser", {
                        name: userLabel(participant.userId),
                      })}
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
              aria-label={t("groupManagement.selectMember")}
              value={selectedUserId}
              disabled={loading}
              onChange={event => setSelectedUserId(event.target.value)}
            >
              <option value="">{t("groupManagement.addMember")}</option>
              {availableUsers.map(user => (
                <option value={user.id} key={user.id}>
                  {user.username || user.email}
                </option>
              ))}
            </Input>
            <Button
              color="primary"
              title={t("groupManagement.addMember")}
              aria-label={t("groupManagement.addSelectedMember")}
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
            {t("groupManagement.policies")}
          </h5>
          <div className="form-check form-switch mb-3">
            <Input
              type="switch"
              id="group-message-policy"
              checked={memberCanSendMessages}
              disabled={loading}
              onChange={event => void updateMessagePolicy(event.target.checked)}
            />
            <Label className="form-check-label" htmlFor="group-message-policy">
              {t("groupManagement.membersCanMessage")}
            </Label>
          </div>
          <div className="form-check form-switch mb-3">
            <Input
              type="switch"
              id="group-leave-policy"
              checked={membersCanLeave}
              disabled={loading}
              onChange={event => void updateLeavePolicy(event.target.checked)}
            />
            <Label className="form-check-label" htmlFor="group-leave-policy">
              {t("groupManagement.membersCanLeavePolicy")}
            </Label>
          </div>
          <Label
            className="form-label font-size-12"
            htmlFor="group-status-input"
          >
            {t("groupManagement.groupStatus")}
          </Label>
          <Input
            id="group-status-input"
            type="select"
            aria-label={t("groupManagement.groupStatus")}
            value={status}
            disabled={loading}
            onChange={event => void updateGroupStatus(event.target.value)}
          >
            <option value="active">{t("groupManagement.active")}</option>
            <option value="closed">{t("groupManagement.closed")}</option>
            <option value="archived">{t("groupManagement.archived")}</option>
          </Input>
          <p className="text-muted small mb-0 mt-3">
            {t("groupManagement.policiesAutoSave")}
          </p>
        </section>
      )}

      {canChangeSettings && ownerCandidates.length > 0 && (
        <section
          className="group-info-section"
          aria-labelledby="group-ownership-heading"
        >
          <h5 id="group-ownership-heading" className="group-info-heading">
            {t("groupManagement.ownership")}
          </h5>
          <div className="input-group">
            <Input
              type="select"
              id="group-owner-input"
              aria-label={t("groupManagement.transferOwnership")}
              value={ownerUserId}
              disabled={loading}
              onChange={event => setOwnerUserId(event.target.value)}
            >
              <option value="">{t("groupManagement.selectNewOwner")}</option>
              {ownerCandidates.map(participant => (
                <option value={participant.userId} key={participant.userId}>
                  {userLabel(participant.userId)}
                </option>
              ))}
            </Input>
            <Button
              color="primary"
              title={t("groupManagement.transferOwnership")}
              aria-label={t("groupManagement.transferOwnership")}
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
            {t("groupManagement.yourMembership")}
          </h5>
          <p className="text-muted font-size-12">
            {t("groupManagement.membershipDescription", {
              role: t(`groupManagement.role.${currentParticipant.role}`),
            })}
          </p>
          <Button
            outline
            color="danger"
            className="w-100"
            title={
              isOwner
                ? t("groupManagement.transferBeforeLeaving")
                : !conversation.membersCanLeave
                  ? t("groupManagement.membersCannotLeave")
                  : t("groupManagement.leaveGroup")
            }
            disabled={loading || isOwner || !conversation.membersCanLeave}
            onClick={leaveGroup}
          >
            <i className="bx bx-log-out me-1" aria-hidden="true"></i>
            {t("groupManagement.leaveGroup")}
          </Button>
        </section>
      )}
    </div>
  );
};

export default GroupManagement;
