import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "../users/user-role.enum";
import { UsersService } from "../users/users.service";
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
];

function createService() {
  const usersService = {
    findById: jest.fn(async (id: string) =>
      users.find((user) => user.id === id),
    ),
    findByIdSync: jest.fn((id: string) => users.find((user) => user.id === id)),
  } as unknown as UsersService;

  return new TicketsService(usersService);
}

describe("TicketsService", () => {
  it("creates a ticket and only lists it for its requester", async () => {
    const service = createService();
    const created = await service.create(users[0].id, {
      subject: "Cannot join release group",
      message: "Joining the release group returns an error.",
      priority: SupportTicketPriority.High,
    });

    expect(created).toMatchObject({
      requesterId: users[0].id,
      status: SupportTicketStatus.Open,
      requester: {
        username: "user_one",
      },
    });
    expect(service.findAll(users[0].id, UserRole.User, {}).items).toHaveLength(
      1,
    );
    expect(service.findAll(users[1].id, UserRole.User, {}).items).toHaveLength(
      0,
    );
    expect(() =>
      service.findOne(created.id, users[1].id, UserRole.User),
    ).toThrow(ForbiddenException);
  });

  it("lets an admin filter and resolve a ticket", async () => {
    const service = createService();
    const created = await service.create(users[0].id, {
      subject: "Socket delivery issue",
      message: "Messages only appear after a manual refresh.",
      priority: SupportTicketPriority.Medium,
    });

    const filtered = service.findAll("admin-id", UserRole.Admin, {
      search: "socket",
      status: SupportTicketStatus.Open,
    });
    expect(filtered.pageInfo.total).toBe(1);

    const updated = await service.update(created.id, {
      status: SupportTicketStatus.Resolved,
      priority: SupportTicketPriority.High,
      adminNote: "Socket subscription was restored.",
    });
    expect(updated).toMatchObject({
      status: SupportTicketStatus.Resolved,
      priority: SupportTicketPriority.High,
      adminNote: "Socket subscription was restored.",
    });
    expect(updated.resolvedAt).toBeInstanceOf(Date);
  });
});
