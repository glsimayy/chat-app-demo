import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  ConversationCatchUp,
  getConversationCatchUp,
} from "../../../api/catchUp";
import CatchUpPanel from "./CatchUpPanel";

jest.mock("../../../api/catchUp", () => ({
  getConversationCatchUp: jest.fn(),
}));

const mockedGetCatchUp = getConversationCatchUp as jest.MockedFunction<
  typeof getConversationCatchUp
>;

const catchUp: ConversationCatchUp = {
  conversationId: "conversation-1",
  window: "2h",
  startAt: "2026-07-29T10:00:00.000Z",
  endAt: "2026-07-29T12:00:00.000Z",
  generatedAt: "2026-07-29T12:00:00.000Z",
  summary: "2 messages were posted by 2 participants in the last 2 hours.",
  messageCount: 2,
  participantCount: 2,
  replyCount: 1,
  attachmentCount: 0,
  systemEventCount: 0,
  analyzedMessageCount: 2,
  truncated: false,
  activeParticipants: [
    { userId: "user-1", username: "emiradmin", messageCount: 1 },
    { userId: "user-2", username: "asliuser", messageCount: 1 },
  ],
  topics: [{ label: "deployment", count: 2 }],
  keyMoments: [
    {
      messageId: "message-1",
      kind: "decision",
      senderId: "user-1",
      senderUsername: "emiradmin",
      preview: "Deployment will start at 17:00.",
      createdAt: "2026-07-29T11:45:00.000Z",
      replyCount: 1,
      attachmentCount: 0,
    },
  ],
};

describe("CatchUpPanel", () => {
  beforeEach(() => {
    mockedGetCatchUp.mockResolvedValue(catchUp);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders activity and opens a selected key message", async () => {
    const onClose = jest.fn();
    const onSelectMessage = jest.fn();

    render(
      <CatchUpPanel
        conversationId="conversation-1"
        onClose={onClose}
        onSelectMessage={onSelectMessage}
      />,
    );

    expect(await screen.findByText(catchUp.summary)).toBeInTheDocument();
    expect(screen.getByText("deployment")).toBeInTheDocument();
    expect(
      screen.getByText("Deployment will start at 17:00."),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByText("Deployment will start at 17:00.").closest("button")!,
    );

    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(onSelectMessage).toHaveBeenCalledWith("message-1"),
    );
  });
});
