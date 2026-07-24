export const CALL_SOCKET_RECOVERY_MS = 17_000;
export const CALL_PEER_RECOVERY_MS = 12_000;

export type PeerConnectionAction = "connected" | "recover" | "wait" | "ignore";

export const getPeerConnectionAction = (
  state: RTCPeerConnectionState,
): PeerConnectionAction => {
  if (state === "connected") {
    return "connected";
  }

  if (state === "disconnected" || state === "failed") {
    return "recover";
  }

  if (state === "closed") {
    return "ignore";
  }

  return "wait";
};
