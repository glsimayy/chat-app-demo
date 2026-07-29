import { isMessageReportable } from "./messageReporting";

describe("isMessageReportable", () => {
  it("allows received user messages", () => {
    expect(
      isMessageReportable({
        isFromMe: false,
        isDeleted: false,
        messageType: "user",
        senderId: "user-2",
      }),
    ).toBe(true);
  });

  it.each([
    { messageType: "system", senderId: "user-2" },
    { messageType: "SYSTEM", senderId: "user-2" },
    { messageType: "user", senderId: "system" },
    { messageType: undefined, senderId: " SYSTEM " },
  ])("rejects system messages identified by type or sender", message => {
    expect(
      isMessageReportable({
        isFromMe: false,
        isDeleted: false,
        ...message,
      }),
    ).toBe(false);
  });

  it("rejects own and deleted messages", () => {
    expect(
      isMessageReportable({
        isFromMe: true,
        isDeleted: false,
        messageType: "user",
        senderId: "user-2",
      }),
    ).toBe(false);
    expect(
      isMessageReportable({
        isFromMe: false,
        isDeleted: true,
        messageType: "user",
        senderId: "user-2",
      }),
    ).toBe(false);
  });
});
