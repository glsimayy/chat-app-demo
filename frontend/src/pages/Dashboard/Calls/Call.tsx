import React, { useMemo } from "react";
import classnames from "classnames";
import { Button } from "reactstrap";

import { CallItem } from "../../../data/calls";
import { useAudioCall } from "../../../features/audio-call/AudioCallProvider";
import { usePresence } from "../../../features/presence/PresenceProvider";

interface CallProps {
  call: CallItem;
}

const statusCopy: Record<CallItem["status"], string> = {
  ringing: "Ringing",
  active: "In progress",
  completed: "Completed",
  missed: "Missed",
  declined: "Declined",
  failed: "Failed",
};

const Call = ({ call }: CallProps) => {
  const { startCall } = useAudioCall();
  const { isOnline } = usePresence();
  const online = isOnline(call.peerId);
  const fullName = `${call.firstName} ${call.lastName}`.trim();
  const initials = `${call.firstName.charAt(0)}${call.lastName.charAt(0)}`;
  const date = new Date(call.callDate).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const isIncoming = call.direction === "incoming";
  const statusClass = call.status === "missed" ? "text-danger" : "text-muted";
  const avatarClass = useMemo(
    () =>
      [
        "bg-primary",
        "bg-danger",
        "bg-info",
        "bg-warning",
        "bg-secondary",
        "bg-pink",
        "bg-purple",
      ][
        Array.from(call.peerId || fullName).reduce(
          (sum, character) => sum + character.charCodeAt(0),
          0,
        ) % 7
      ],
    [call.peerId, fullName],
  );

  const callAgain = () =>
    startCall({
      conversationId: call.conversationId,
      targetUserId: call.peerId,
      displayName: fullName,
      profileImage: call.profileImage,
    });

  return (
    <li className="call-history-item">
      <div className="d-flex align-items-center">
        <div
          className={classnames(
            "chat-user-img flex-shrink-0 avatar-xs me-3",
            { online },
          )}
        >
          {call.profileImage ? (
            <img
              src={call.profileImage}
              className="rounded-circle avatar-xs"
              alt=""
            />
          ) : (
            <span
              className={classnames(
                "avatar-title rounded-circle text-uppercase text-white",
                avatarClass,
              )}
            >
              {initials || "U"}
            </span>
          )}
          {online && <span className="user-status" aria-hidden="true"></span>}
        </div>

        <div className="flex-grow-1 overflow-hidden">
          <p className="text-truncate mb-1 fw-semibold">{fullName}</p>
          <div className={`font-size-12 text-truncate ${statusClass}`}>
            <i
              className={classnames(
                "align-bottom me-1",
                isIncoming
                  ? "ri-arrow-left-down-fill"
                  : "ri-arrow-right-up-fill",
                {
                  "text-success": call.status === "completed",
                  "text-danger": call.status !== "completed",
                },
              )}
              aria-hidden="true"
            ></i>
            {statusCopy[call.status]} · {date}
          </div>
        </div>

        <div className="flex-shrink-0 ms-3 text-end">
          {call.status === "completed" && (
            <div className="font-size-11 text-muted mb-1">
              {call.callDuration}
            </div>
          )}
          <Button
            color="link"
            type="button"
            className="call-again-button p-0 font-size-20"
            onClick={() => void callAgain()}
            disabled={!online}
            title={online ? `Call ${fullName}` : `${fullName} is offline`}
            aria-label={online ? `Call ${fullName}` : `${fullName} is offline`}
          >
            <i className="bx bxs-phone-call align-middle"></i>
          </Button>
        </div>
      </div>
    </li>
  );
};

export default Call;
