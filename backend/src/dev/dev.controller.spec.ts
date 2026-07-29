import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AdminMonitoringService } from "../admin-monitoring/admin-monitoring.service";
import { BookmarksService } from "../bookmarks/bookmarks.service";
import { CallsService } from "../calls/calls.service";
import { ContactInvitationsService } from "../contact-invitations/contact-invitations.service";
import { ConversationsService } from "../conversations/conversations.service";
import { ModerationService } from "../moderation/moderation.service";
import { TicketsService } from "../tickets/tickets.service";
import { UsersService } from "../users/users.service";
import { DevController } from "./dev.controller";

function createController(config: Record<string, string | undefined>) {
  const configService = {
    get: jest.fn((key: string, fallback?: string) => config[key] ?? fallback),
  } as unknown as ConfigService;
  const adminMonitoringService = {
    clearAll: jest
      .fn()
      .mockResolvedValue({ deletedAdminMessageAccessAudits: 1 }),
  } as unknown as AdminMonitoringService;
  const bookmarksService = {
    clearAll: jest.fn().mockResolvedValue({ deletedBookmarks: 1 }),
  } as unknown as BookmarksService;
  const contactInvitationsService = {
    clearAll: jest.fn().mockResolvedValue({ deletedContactInvitations: 1 }),
  } as unknown as ContactInvitationsService;
  const callsService = {
    clearAll: jest.fn().mockResolvedValue({ deletedCalls: 1 }),
  } as unknown as CallsService;
  const conversationsService = {
    clearAll: jest.fn().mockResolvedValue({ deletedConversations: 2 }),
  } as unknown as ConversationsService;
  const moderationService = {
    clearAll: jest.fn().mockResolvedValue({ deletedMessageReports: 1 }),
  } as unknown as ModerationService;
  const usersService = {
    clearAll: jest.fn().mockResolvedValue({ deletedUsers: 3 }),
  } as unknown as UsersService;
  const ticketsService = {
    clearAll: jest.fn().mockResolvedValue({ deletedTickets: 1 }),
  } as unknown as TicketsService;

  return {
    controller: new DevController(
      configService,
      adminMonitoringService,
      bookmarksService,
      callsService,
      contactInvitationsService,
      conversationsService,
      moderationService,
      ticketsService,
      usersService,
    ),
    adminMonitoringService,
    bookmarksService,
    callsService,
    contactInvitationsService,
    conversationsService,
    moderationService,
    ticketsService,
    usersService,
  };
}

describe("DevController", () => {
  it("hides dev routes when they are disabled", async () => {
    const { controller } = createController({
      DEV_ROUTES_ENABLED: "false",
      DEV_RESET_SECRET: "reset-secret",
    });

    await expect(controller.resetInMemoryData("reset-secret")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("rejects an invalid reset secret", async () => {
    const { controller } = createController({
      DEV_ROUTES_ENABLED: "true",
      DEV_RESET_SECRET: "reset-secret",
    });

    await expect(controller.resetInMemoryData("wrong-secret")).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("clears conversations and users with the configured secret", async () => {
    const {
      controller,
      adminMonitoringService,
      bookmarksService,
      callsService,
      contactInvitationsService,
      conversationsService,
      moderationService,
      ticketsService,
      usersService,
    } = createController({
      DEV_ROUTES_ENABLED: "true",
      DEV_RESET_SECRET: "reset-secret",
    });

    await expect(controller.resetInMemoryData("reset-secret")).resolves.toEqual(
      {
        adminMonitoring: { deletedAdminMessageAccessAudits: 1 },
        bookmarks: { deletedBookmarks: 1 },
        calls: { deletedCalls: 1 },
        contactInvitations: { deletedContactInvitations: 1 },
        moderation: { deletedMessageReports: 1 },
        conversations: { deletedConversations: 2 },
        tickets: { deletedTickets: 1 },
        users: { deletedUsers: 3 },
      },
    );
    expect(adminMonitoringService.clearAll).toHaveBeenCalledTimes(1);
    expect(bookmarksService.clearAll).toHaveBeenCalledTimes(1);
    expect(callsService.clearAll).toHaveBeenCalledTimes(1);
    expect(contactInvitationsService.clearAll).toHaveBeenCalledTimes(1);
    expect(moderationService.clearAll).toHaveBeenCalledTimes(1);
    expect(conversationsService.clearAll).toHaveBeenCalledTimes(1);
    expect(ticketsService.clearAll).toHaveBeenCalledTimes(1);
    expect(usersService.clearAll).toHaveBeenCalledTimes(1);
  });
});
