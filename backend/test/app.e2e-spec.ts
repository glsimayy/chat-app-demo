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

  beforeEach(() => {
    conversationsService.clearAll();
    usersService.clearAll();
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

  it("enforces the admin-only manual group rule", async () => {
    const admin = await register("admin_user");
    const member = await register("member_user");

    expect(admin.user.role).toBe("admin");
    expect(member.user.role).toBe("user");

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
