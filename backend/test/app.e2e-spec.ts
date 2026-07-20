import { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { AuthService } from "../src/auth/auth.service";
import { configureApplication } from "../src/config/configure-application";
import { ConversationsService } from "../src/conversations/conversations.service";
import { UsersService } from "../src/users/users.service";

describe("App e2e", () => {
  let app: NestExpressApplication;
  let conversationsService: ConversationsService;
  let usersService: UsersService;
  let authService: AuthService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.useLogger(false);
    configureApplication(app);
    await app.init();

    conversationsService = app.get(ConversationsService);
    usersService = app.get(UsersService);
    authService = app.get(AuthService);
  });

  beforeEach(async () => {
    await conversationsService.clearAll();
    await usersService.clearAll();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns the standard response envelope and request id", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/health")
      .expect(200);

    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
    expect(response.body).toMatchObject({
      success: true,
      data: { status: "ok", service: "chat-app-backend" },
    });
  });

  it("rejects unknown request fields", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({
        email: "validation@test.local",
        username: "validation_user",
        password: "Password123!",
        role: "admin",
      })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      statusCode: 400,
    });
    expect(response.body.message).toContain("property role should not exist");
  });

  it("enforces the complete group authorization matrix", async () => {
    const admin = await register("admin_user");
    const member = await register("member_user");
    const outsider = await register("outsider_user");

    expect(admin.user.role).toBe("admin");
    expect(member.user.role).toBe("user");
    expect(outsider.user.role).toBe("user");

    await request(app.getHttpServer())
      .post("/api/conversations/groups")
      .set("authorization", `Bearer ${member.accessToken}`)
      .send({ name: "Forbidden Group", participantIds: [admin.user.id] })
      .expect(403);

    const created = await request(app.getHttpServer())
      .post("/api/conversations/groups")
      .set("authorization", `Bearer ${admin.accessToken}`)
      .send({ name: "Admin Group", participantIds: [member.user.id] })
      .expect(201);

    expect(created.body.data).toMatchObject({
      type: "group",
      name: "Admin Group",
      createdBy: admin.user.id,
    });

    await request(app.getHttpServer())
      .patch(`/api/conversations/${created.body.data.id}`)
      .set("authorization", `Bearer ${member.accessToken}`)
      .send({ name: "Member Rename Must Fail" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/conversations/${created.body.data.id}/participants`)
      .set("authorization", `Bearer ${member.accessToken}`)
      .send({ userId: outsider.user.id })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/conversations/${created.body.data.id}`)
      .set("authorization", `Bearer ${outsider.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/conversations/${created.body.data.id}/participants`)
      .set("authorization", `Bearer ${admin.accessToken}`)
      .send({ userId: outsider.user.id })
      .expect(201);

    await request(app.getHttpServer())
      .delete(
        `/api/conversations/${created.body.data.id}/participants/${admin.user.id}`,
      )
      .set("authorization", `Bearer ${admin.accessToken}`)
      .expect(400);

    await request(app.getHttpServer())
      .delete(
        `/api/conversations/${created.body.data.id}/participants/${member.user.id}`,
      )
      .set("authorization", `Bearer ${admin.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/conversations/${created.body.data.id}/messages`)
      .set("authorization", `Bearer ${member.accessToken}`)
      .send({ content: "Removed member message" })
      .expect(404);
  });

  it("deduplicates message retries by clientMessageId", async () => {
    const sender = await register("retry_sender");
    const recipient = await register("retry_recipient");
    const direct = await request(app.getHttpServer())
      .post("/api/conversations/direct")
      .set("authorization", `Bearer ${sender.accessToken}`)
      .send({ participantId: recipient.user.id })
      .expect(201);
    const payload = {
      content: "Exactly once",
      clientMessageId: crypto.randomUUID(),
    };

    const first = await request(app.getHttpServer())
      .post(`/api/conversations/${direct.body.data.id}/messages`)
      .set("authorization", `Bearer ${sender.accessToken}`)
      .send(payload)
      .expect(201);
    const retry = await request(app.getHttpServer())
      .post(`/api/conversations/${direct.body.data.id}/messages`)
      .set("authorization", `Bearer ${sender.accessToken}`)
      .send(payload)
      .expect(201);
    const history = await request(app.getHttpServer())
      .get(`/api/conversations/${direct.body.data.id}/messages`)
      .set("authorization", `Bearer ${sender.accessToken}`)
      .expect(200);

    expect(retry.body.data.id).toBe(first.body.data.id);
    expect(
      history.body.data.items.filter(
        (message: { clientMessageId?: string }) =>
          message.clientMessageId === payload.clientMessageId,
      ),
    ).toHaveLength(1);
  });

  it("enforces manager roles, group policies, and private management chat", async () => {
    const admin = await createAuthUser("policy_admin");
    const manager = await createAuthUser("policy_manager");
    const member = await createAuthUser("policy_member");

    const created = await request(app.getHttpServer())
      .post("/api/conversations/groups")
      .set("authorization", `Bearer ${admin.accessToken}`)
      .send({
        name: "Release Control",
        description: "Private release coordination",
        participantIds: [manager.user.id, member.user.id],
        managerIds: [manager.user.id],
        membersCanLeave: false,
      })
      .expect(201);
    const groupId = created.body.data.id;

    expect(created.body.data).toMatchObject({
      memberCanSendMessages: false,
      membersCanLeave: false,
      status: "active",
      isBotManaged: false,
    });
    expect(created.body.data.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: admin.user.id,
          role: "owner",
        }),
        expect.objectContaining({
          userId: manager.user.id,
          role: "manager",
        }),
      ]),
    );

    await request(app.getHttpServer())
      .post(`/api/conversations/${groupId}/messages`)
      .set("authorization", `Bearer ${member.accessToken}`)
      .send({ content: "Members are locked by default" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/conversations/${groupId}/messages`)
      .set("authorization", `Bearer ${manager.accessToken}`)
      .send({ content: "Manager announcement" })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/conversations/${groupId}`)
      .set("authorization", `Bearer ${manager.accessToken}`)
      .send({ memberCanSendMessages: true })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/conversations/${groupId}`)
      .set("authorization", `Bearer ${manager.accessToken}`)
      .send({ name: "Release Coordination" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/conversations/${groupId}/leave`)
      .set("authorization", `Bearer ${member.accessToken}`)
      .expect(403);

    const management = await request(app.getHttpServer())
      .get(`/api/conversations/${groupId}/management`)
      .set("authorization", `Bearer ${manager.accessToken}`)
      .expect(200);
    const managementId = management.body.data.id;

    expect(management.body.data).toMatchObject({
      type: "management",
      parentConversationId: groupId,
    });

    await request(app.getHttpServer())
      .get(`/api/conversations/${groupId}/management`)
      .set("authorization", `Bearer ${member.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/conversations/${managementId}/messages`)
      .set("authorization", `Bearer ${manager.accessToken}`)
      .send({ content: "Private manager note" })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/conversations/${managementId}/messages`)
      .set("authorization", `Bearer ${member.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/conversations/${groupId}`)
      .set("authorization", `Bearer ${admin.accessToken}`)
      .send({ memberCanSendMessages: true, membersCanLeave: true })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/conversations/${groupId}/messages`)
      .set("authorization", `Bearer ${member.accessToken}`)
      .send({ content: "Member messaging enabled" })
      .expect(201);

    await request(app.getHttpServer())
      .patch(
        `/api/conversations/${groupId}/participants/${manager.user.id}/role`,
      )
      .set("authorization", `Bearer ${admin.accessToken}`)
      .send({ role: "member" })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/conversations/${groupId}/management`)
      .set("authorization", `Bearer ${manager.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/conversations/${groupId}`)
      .set("authorization", `Bearer ${admin.accessToken}`)
      .send({ status: "closed" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/conversations/${groupId}/messages`)
      .set("authorization", `Bearer ${admin.accessToken}`)
      .send({ content: "Closed groups reject everyone" })
      .expect(403);
  });

  it("returns CORS headers only for configured origins", async () => {
    const allowed = await request(app.getHttpServer())
      .options("/api/health")
      .set("origin", "http://localhost:5173")
      .expect(204);
    const unknown = await request(app.getHttpServer())
      .options("/api/health")
      .set("origin", "https://unknown.example.com")
      .expect(204);

    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
    expect(unknown.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("restricts runtime metrics to administrators", async () => {
    const admin = await register("metrics_admin");
    const member = await register("metrics_member");

    const metrics = await request(app.getHttpServer())
      .get("/api/metrics")
      .set("authorization", `Bearer ${admin.accessToken}`)
      .expect(200);

    expect(metrics.body.data).toMatchObject({
      counters: {
        httpRequestsTotal: expect.any(Number),
        messagesCreatedTotal: expect.any(Number),
      },
      gauges: {
        activeSockets: expect.any(Number),
        averageHttpDurationMs: expect.any(Number),
      },
      socketEventsByName: expect.any(Object),
    });

    await request(app.getHttpServer())
      .get("/api/metrics")
      .set("authorization", `Bearer ${member.accessToken}`)
      .expect(403);
  });

  it("executes idempotent external automation flows as the bot", async () => {
    const admin = await register("automation_admin");
    const member = await register("automation_member");
    const laterMember = await usersService.create({
      username: "automation_later_member",
      email: "automation_later_member@test.local",
      passwordHash: "not-used-by-this-test",
    });
    const secret = "test-bot-secret-with-at-least-32-characters";
    const groupPayload = {
      ownerId: admin.user.id,
      name: "Automated Incident INC-42",
      participantIds: [member.user.id],
      externalRef: "incident-42",
      initialBotMessage: "Incident detected. Investigation has started.",
    };

    const created = await request(app.getHttpServer())
      .post("/api/bot/groups")
      .set("x-bot-secret", secret)
      .send(groupPayload)
      .expect(201);
    const retriedCreate = await request(app.getHttpServer())
      .post("/api/bot/groups")
      .set("x-bot-secret", secret)
      .send(groupPayload)
      .expect(201);
    const users = await request(app.getHttpServer())
      .get("/api/users")
      .set("authorization", `Bearer ${admin.accessToken}`)
      .expect(200);
    const botUser = users.body.data.find(
      (user: { isBot: boolean }) => user.isBot,
    );

    expect(botUser).toMatchObject({
      username: "ellO Automation Bot",
      isBot: true,
    });
    expect(retriedCreate.body.data.id).toBe(created.body.data.id);
    expect(created.body.data).toMatchObject({
      isBotManaged: true,
      memberCanSendMessages: false,
      membersCanLeave: false,
    });
    expect(
      created.body.data.participants.some(
        (participant: { role: string }) => participant.role === "owner",
      ),
    ).toBe(false);
    expect(created.body.data.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: admin.user.id,
          role: "manager",
        }),
        expect.objectContaining({ userId: member.user.id }),
        expect.objectContaining({ userId: botUser.id }),
      ]),
    );

    await request(app.getHttpServer())
      .post(`/api/conversations/${created.body.data.id}/messages`)
      .set("authorization", `Bearer ${member.accessToken}`)
      .send({ content: "BOT group members are locked by default" })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/bot/groups/${created.body.data.id}`)
      .set("x-bot-secret", secret)
      .send({ memberCanSendMessages: true })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/conversations/${created.body.data.id}/messages`)
      .set("authorization", `Bearer ${member.accessToken}`)
      .send({ content: "BOT group member messaging enabled" })
      .expect(201);

    const participants = await request(app.getHttpServer())
      .post(`/api/bot/groups/${created.body.data.id}/participants`)
      .set("x-bot-secret", secret)
      .send({ participantIds: [laterMember.id] })
      .expect(201);
    const retriedParticipants = await request(app.getHttpServer())
      .post(`/api/bot/groups/${created.body.data.id}/participants`)
      .set("x-bot-secret", secret)
      .send({ participantIds: [laterMember.id] })
      .expect(201);

    expect(participants.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: laterMember.id }),
      ]),
    );
    expect(retriedParticipants.body.data).toHaveLength(
      participants.body.data.length,
    );

    const messagePayload = {
      content: "Severity raised to critical.",
      clientMessageId: crypto.randomUUID(),
    };
    const message = await request(app.getHttpServer())
      .post(`/api/bot/groups/${created.body.data.id}/messages`)
      .set("x-bot-secret", secret)
      .send(messagePayload)
      .expect(201);
    const retriedMessage = await request(app.getHttpServer())
      .post(`/api/bot/groups/${created.body.data.id}/messages`)
      .set("x-bot-secret", secret)
      .send(messagePayload)
      .expect(201);
    const history = await request(app.getHttpServer())
      .get(`/api/conversations/${created.body.data.id}/messages`)
      .set("authorization", `Bearer ${member.accessToken}`)
      .expect(200);

    expect(message.body.data).toMatchObject({
      senderId: botUser.id,
      content: messagePayload.content,
      messageType: "user",
    });
    expect(retriedMessage.body.data.id).toBe(message.body.data.id);
    expect(
      history.body.data.items.filter(
        (item: { clientMessageId: string }) =>
          item.clientMessageId === messagePayload.clientMessageId,
      ),
    ).toHaveLength(1);
    expect(
      history.body.data.items.filter(
        (item: { content: string }) =>
          item.content === groupPayload.initialBotMessage,
      ),
    ).toHaveLength(1);

    await request(app.getHttpServer())
      .patch(`/api/conversations/${created.body.data.id}/owner`)
      .set("authorization", `Bearer ${admin.accessToken}`)
      .send({ userId: botUser.id })
      .expect(400);
    await request(app.getHttpServer())
      .delete(
        `/api/conversations/${created.body.data.id}/participants/${botUser.id}`,
      )
      .set("authorization", `Bearer ${admin.accessToken}`)
      .expect(400);

    const regularGroup = await request(app.getHttpServer())
      .post("/api/conversations/groups")
      .set("authorization", `Bearer ${admin.accessToken}`)
      .send({ name: "Regular Group", participantIds: [member.user.id] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/conversations/${regularGroup.body.data.id}/participants`)
      .set("authorization", `Bearer ${admin.accessToken}`)
      .send({ userId: botUser.id })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/bot/groups/${regularGroup.body.data.id}/messages`)
      .set("x-bot-secret", secret)
      .send({ content: "Must not be delivered" })
      .expect(403);
  });

  it("rate limits repeated login attempts", async () => {
    const login = {
      email: "missing@test.local",
      password: "Password123!",
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post("/api/auth/login")
        .send(login)
        .expect(401);
    }

    const limited = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send(login)
      .expect(429);

    expect(limited.body).toMatchObject({
      success: false,
      statusCode: 429,
    });
    expect(limited.headers["retry-after"]).toMatch(/^\d+$/);
  });

  it("rate limits repeated invalid bot webhook attempts", async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await request(app.getHttpServer())
        .post("/api/bot/create-group")
        .set("x-bot-secret", "wrong-secret")
        .send({})
        .expect(401);
    }

    const limited = await request(app.getHttpServer())
      .post("/api/bot/create-group")
      .set("x-bot-secret", "wrong-secret")
      .send({})
      .expect(429);

    expect(limited.body).toMatchObject({
      success: false,
      statusCode: 429,
    });
  });

  async function register(username: string) {
    const response = await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({
        email: `${username}@test.local`,
        username,
        password: "Password123!",
      })
      .expect(201);

    return response.body.data;
  }

  async function createAuthUser(username: string) {
    return authService.register({
      username,
      email: `${username}@test.local`,
      password: "Password123!",
    });
  }
});
