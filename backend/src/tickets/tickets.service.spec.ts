import { ConflictException, ForbiddenException } from "@nestjs/common";
import { UserRole } from "../users/user-role.enum";
import { UsersService } from "../users/users.service";
import { SupportTicketActivityAction } from "./support-ticket-activity-action.enum";
import { SupportTicketAssignmentFilter } from "./support-ticket-assignment-filter.enum";
import { SupportTicketPriority } from "./support-ticket-priority.enum";
import { SupportTicketStatus } from "./support-ticket-status.enum";
import { TicketsService } from "./tickets.service";

const users = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    username: "user_one",
    email: "user1@ello.local",
    role: UserRole.User,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    username: "user_two",
    email: "user2@ello.local",
    role: UserRole.User,
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    username: "admin_one",
    email: "admin1@ello.local",
    role: UserRole.Admin,
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    username: "admin_two",
    email: "admin2@ello.local",
    role: UserRole.Admin,
  },
];

const requester = users[0];
const otherUser = users[1];
const adminOne = users[2];
const adminTwo = users[3];

function createService() {
  const usersService = {
    findById: jest.fn(async (id: string) =>
      users.find((user) => user.id === id),
    ),
    findByIdSync: jest.fn((id: string) => users.find((user) => user.id === id)),
  } as unknown as UsersService;

  return new TicketsService(usersService);
}

async function createTicket(service: TicketsService) {
  return service.create(requester.id, {
    subject: "Socket delivery issue",
    message: "Messages only appear after a manual refresh.",
    priority: SupportTicketPriority.Medium,
  });
}

describe("TicketsService", () => {
  it("creates an unassigned ticket visible only to its requester and admins", async () => {
    const service = createService();
    const created = await createTicket(service);

    expect(created).toMatchObject({
      requesterId: requester.id,
      assignedAdminId: null,
      version: 1,
      status: SupportTicketStatus.Open,
      requester: { username: "user_one" },
    });
    expect(created.activities[0]).toMatchObject({
      action: SupportTicketActivityAction.Created,
      actorId: requester.id,
    });
    expect(service.findAll(requester.id, UserRole.User, {}).items).toHaveLength(
      1,
    );
    expect(service.findAll(otherUser.id, UserRole.User, {}).items).toHaveLength(
      0,
    );
    expect(() =>
      service.findOne(created.id, otherUser.id, UserRole.User),
    ).toThrow(ForbiddenException);
    expect(
      service.findAll(adminOne.id, UserRole.Admin, {
        assignment: SupportTicketAssignmentFilter.Unassigned,
      }).items,
    ).toHaveLength(1);
  });

  it("claims, filters, and resolves a ticket with activity history", async () => {
    const service = createService();
    const created = await createTicket(service);
    const claimed = await service.claim(created.id, adminOne.id, {
      expectedVersion: created.version,
    });

    expect(claimed).toMatchObject({
      assignedAdminId: adminOne.id,
      version: 2,
      assignedAdmin: { username: "admin_one" },
    });
    expect(
      service.findAll(adminOne.id, UserRole.Admin, {
        assignment: SupportTicketAssignmentFilter.Mine,
      }).items,
    ).toHaveLength(1);

    const updated = await service.update(created.id, adminOne.id, {
      expectedVersion: claimed.version,
      status: SupportTicketStatus.Resolved,
      priority: SupportTicketPriority.High,
      adminNote: "Socket subscription was restored.",
    });
    expect(updated).toMatchObject({
      status: SupportTicketStatus.Resolved,
      priority: SupportTicketPriority.High,
      adminNote: "Socket subscription was restored.",
      version: 3,
    });
    expect(updated.resolvedAt).toBeInstanceOf(Date);
    expect(updated.activities.map((activity) => activity.action)).toEqual(
      expect.arrayContaining([
        SupportTicketActivityAction.Created,
        SupportTicketActivityAction.Assigned,
        SupportTicketActivityAction.StatusChanged,
        SupportTicketActivityAction.PriorityChanged,
        SupportTicketActivityAction.NoteUpdated,
      ]),
    );
  });

  it("transfers ownership and rejects stale or non-owner updates", async () => {
    const service = createService();
    const created = await createTicket(service);
    const claimed = await service.claim(created.id, adminOne.id, {
      expectedVersion: 1,
    });

    await expect(
      service.claim(created.id, adminTwo.id, {
        expectedVersion: claimed.version,
      }),
    ).rejects.toThrow(ConflictException);

    const transferred = await service.assign(created.id, adminOne.id, {
      adminId: adminTwo.id,
      expectedVersion: claimed.version,
    });
    expect(transferred).toMatchObject({
      assignedAdminId: adminTwo.id,
      version: 3,
    });

    await expect(
      service.update(created.id, adminTwo.id, {
        expectedVersion: claimed.version,
        status: SupportTicketStatus.InProgress,
      }),
    ).rejects.toThrow(ConflictException);
    await expect(
      service.update(created.id, adminOne.id, {
        expectedVersion: transferred.version,
        status: SupportTicketStatus.InProgress,
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
