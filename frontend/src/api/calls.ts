import { CallItem } from "../data/calls";
import { APIClient } from "./apiCore";

const api = new APIClient();

const splitDisplayName = (displayName: string) => {
  const parts = displayName.split(/[\s._-]+/).filter(Boolean);
  return {
    firstName: parts[0] || "User",
    lastName: parts.slice(1).join(" "),
  };
};

const formatDuration = (seconds: number) => {
  if (seconds < 1) {
    return "< 1s";
  }
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(
    2,
    "0",
  )}`;
};

const getCalls = () =>
  api.get("/calls").then((response: any) => {
    const calls = Array.isArray(response) ? response : response?.items || [];

    return calls.map((call: any): CallItem => {
      const name = splitDisplayName(call.peer?.username || "User");
      return {
        callId: call.id,
        conversationId: call.conversationId,
        peerId: call.peer?.id,
        firstName: name.firstName,
        lastName: name.lastName,
        profileImage: call.peer?.profileImage,
        callDuration: formatDuration(call.durationSeconds || 0),
        direction: call.direction,
        callDate: call.startedAt,
        status: call.status,
      };
    });
  });

export { getCalls };
