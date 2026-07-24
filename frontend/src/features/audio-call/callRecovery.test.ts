import {
  CALL_PEER_RECOVERY_MS,
  CALL_SOCKET_RECOVERY_MS,
  getPeerConnectionAction,
} from "./callRecovery";

describe("audio call recovery", () => {
  it("treats transient peer states as recoverable", () => {
    expect(getPeerConnectionAction("disconnected")).toBe("recover");
    expect(getPeerConnectionAction("failed")).toBe("recover");
  });

  it("does not classify connecting states as terminal", () => {
    expect(getPeerConnectionAction("new")).toBe("wait");
    expect(getPeerConnectionAction("connecting")).toBe("wait");
  });

  it("keeps the client grace period longer than media recovery", () => {
    expect(CALL_SOCKET_RECOVERY_MS).toBeGreaterThan(CALL_PEER_RECOVERY_MS);
  });
});
