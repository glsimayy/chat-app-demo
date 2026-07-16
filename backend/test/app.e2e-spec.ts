import { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/config/configure-application";
import { ConversationsService } from "../src/conversations/conversations.service";
import { UsersService } from "../src/users/users.service";

describe("App e2e", () => {
  let app: NestExpressApplication;
  let conversationsService: ConversationsService;
  let usersService: UsersService;

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
});
