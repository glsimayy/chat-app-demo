import { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AdminMonitoringService } from "../src/admin-monitoring/admin-monitoring.service";
import { AppModule } from "../src/app.module";
import { AuthService } from "../src/auth/auth.service";
import { configureApplication } from "../src/config/configure-application";
import { ConversationsService } from "../src/conversations/conversations.service";
import { ModerationService } from "../src/moderation/moderation.service";
import { UsersService } from "../src/users/users.service";

describe("App e2e", () => {
  let app: NestExpressApplication;
  let conversationsService: ConversationsService;
  let usersService: UsersService;
  let authService: AuthService;
  let adminMonitoringService: AdminMonitoringService;
  let moderationService: ModerationService;

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
    adminMonitoringService = app.get(AdminMonitoringService);
    moderationService = app.get(ModerationService);
  });

  beforeEach(async () => {
    await adminMonitoringService.clearAll();
    await moderationService.clearAll();
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

  it("keeps message content masked and audits every admin reveal", async () => {
    const admin = await createAuthUser("audit_admin");
    const member = await createAuthUser("audit_member");
    const direct = await request(app.getHttpServer())
      .post("/api/conversations/direct")
      .set("authorization", `Bearer ${admin.accessToken}`)
      .send({ participantId: member.user.id })
      .expect(201);
    const createdMessage = await request(app.getHttpServer())
      .post(`/api/conversations/${direct.body.data.id}/messages`)
      .set("authorization", `Bearer ${member.accessToken}`)
      .send({
        content: "Sensitive support context",
        clientMessageId: crypto.randomUUID(),
      })
      .expect(201);
    const image = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlVQAAAAASUVORK5CYII=",
      "base64",
    );
    const attachmentMessage = await request(app.getHttpServer())
      .post(`/api/conversations/${direct.body.data.id}/messages/attachments`)
      .set("authorization", `Bearer ${member.accessToken}`)
      .field("clientMessageId", crypto.randomUUID())
      .attach("files", image, {
        filename: "moderation-sample.png",
        contentType: "image/png",
      })
      .expect(201);
    const attachmentId = attachmentMessage.body.data.attachments[0].id;

    await request(app.getHttpServer())
      .get("/api/admin/messages")
      .set("authorization", `Bearer ${member.accessToken}`)
      .expect(403);

    const listed = await request(app.getHttpServer())
      .get("/api/admin/messages")
      .set("authorization", `Bearer ${admin.accessToken}`)
      .expect(200);
    const metadata = listed.body.data.items.find(
      (item: { id: string }) => item.id === createdMessage.body.data.id,
    );

    expect(metadata).toMatchObject({
      id: createdMessage.body.data.id,
      contentState: "masked",
      sender: { id: member.user.id },
      conversation: { id: direct.body.data.id, type: "direct" },
    });
    expect(metadata).not.toHaveProperty("content");

    await request(app.getHttpServer())
      .post(`/api/admin/messages/${createdMessage.body.data.id}/reveal`)
      .set("authorization", `Bearer ${admin.accessToken}`)
      .send({
        reason: "support_request",
        justification: "no",
      })
      .expect(400);

    const revealed = await request(app.getHttpServer())
      .post(`/api/admin/messages/${createdMessage.body.data.id}/reveal`)
      .set("authorization", `Bearer ${admin.accessToken}`)
      .send({
        reason: "support_request",
        justification: "Investigating ticket TICKET-4821 with user consent.",
      })
      .expect(201);

    expect(revealed.body.data).toMatchObject({
      messageId: createdMessage.body.data.id,
      content: "Sensitive support context",
      attachments: [],
    });

    await request(app.getHttpServer())
      .get(
        `/api/admin/messages/${attachmentMessage.body.data.id}/attachments/${attachmentId}`,
      )
      .query({ auditId: revealed.body.data.auditId })
      .set("authorization", `Bearer ${admin.accessToken}`)
      .expect(403);

    const attachmentReveal = await request(app.getHttpServer())
      .post(`/api/admin/messages/${attachmentMessage.body.data.id}/reveal`)
      .set("authorization", `Bearer ${admin.accessToken}`)
      .send({
        reason: "abuse_investigation",
        justification: "Reviewing a reported image attachment for moderation.",
      })
      .expect(201);
    expect(attachmentReveal.body.data).toMatchObject({
      messageId: attachmentMessage.body.data.id,
      content: "",
      attachments: [
        expect.objectContaining({
          id: attachmentId,
          fileName: "moderation-sample.png",
          mimeType: "image/png",
          fileSize: image.length,
        }),
      ],
    });

    const auditedAttachment = await request(app.getHttpServer())
      .get(
        `/api/admin/messages/${attachmentMessage.body.data.id}/attachments/${attachmentId}`,
      )
      .query({ auditId: attachmentReveal.body.data.auditId })
      .set("authorization", `Bearer ${admin.accessToken}`)
      .expect("content-type", /image\/png/)
      .expect(200);
    expect(auditedAttachment.body).toEqual(image);

    const audits = await request(app.getHttpServer())
      .get("/api/admin/message-access-audits")
      .set("authorization", `Bearer ${admin.accessToken}`)
      .expect(200);

    expect(audits.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: "support_request",
          justification: "Investigating ticket TICKET-4821 with user consent.",
          admin: expect.objectContaining({ id: admin.user.id }),
          message: expect.objectContaining({ id: createdMessage.body.data.id }),
        }),
        expect.objectContaining({
          reason: "abuse_investigation",
          message: expect.objectContaining({
            id: attachmentMessage.body.data.id,
          }),
        }),
      ]),
    );

    const overview = await request(app.getHttpServer())
      .get("/api/admin/overview")
      .set("authorization", `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(overview.body.data.totals).toMatchObject({
      users: 2,
      directConversations: 1,
      messages: 2,
      attachments: 1,
      messageContentAccesses: 2,
    });
  });

  it("reports messages and enforces audited moderation decisions", async () => {
    const admin = await createAuthUser("moderation_admin");
    const sender = await createAuthUser("moderation_sender");
    const reporter = await createAuthUser("moderation_reporter");
    const direct = await request(app.getHttpServer())
      .post("/api/conversations/direct")
      .set("authorization", `Bearer ${reporter.accessToken}`)
      .send({ participantId: sender.user.id })
      .expect(201);
    const firstMessage = await request(app.getHttpServer())
      .post(`/api/conversations/${direct.body.data.id}/messages`)
      .set("authorization", `Bearer ${sender.accessToken}`)
      .send({
        content: "Reported moderation evidence",
        clientMessageId: crypto.randomUUID(),
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/message-reports")
      .set("authorization", `Bearer ${sender.accessToken}`)
      .send({
        messageId: firstMessage.body.data.id,
        reason: "harassment",
      })
      .expect(400);

    const systemGroup = await request(app.getHttpServer())
      .post("/api/conversations/groups")
      .set("authorization", `Bearer ${admin.accessToken}`)
      .send({
        name: "System message reporting guard",
        participantIds: [reporter.user.id],
      })
      .expect(201);
    const systemGroupHistory = await request(app.getHttpServer())
      .get(`/api/conversations/${systemGroup.body.data.id}/messages`)
      .set("authorization", `Bearer ${reporter.accessToken}`)
      .expect(200);
    const systemMessage = systemGroupHistory.body.data.items.find(
      (message: { messageType: string }) => message.messageType === "system",
    );
    expect(systemMessage).toBeDefined();

    await request(app.getHttpServer())
      .post("/api/message-reports")
      .set("authorization", `Bearer ${reporter.accessToken}`)
      .send({
        messageId: systemMessage.id,
        reason: "other",
      })
      .expect(400);

    const report = await request(app.getHttpServer())
      .post("/api/message-reports")
      .set("authorization", `Bearer ${reporter.accessToken}`)
      .send({
        messageId: firstMessage.body.data.id,
        reason: "harassment",
        details: "Repeated targeted abuse in a direct conversation.",
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/message-reports")
      .set("authorization", `Bearer ${reporter.accessToken}`)
      .send({
        messageId: firstMessage.body.data.id,
        reason: "harassment",
      })
      .expect(409);

    await request(app.getHttpServer())
      .get("/api/admin/moderation/reports")
      .set("authorization", `Bearer ${reporter.accessToken}`)
      .expect(403);

    const queue = await request(app.getHttpServer())
      .get("/api/admin/moderation/reports")
      .query({ status: "pending" })
      .set("authorization", `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(queue.body.data.items).toEqual([
      expect.objectContaining({
        id: report.body.data.id,
        status: "pending",
        reason: "harassment",
        reporter: expect.objectContaining({ id: reporter.user.id }),
        reportedUser: expect.objectContaining({ id: sender.user.id }),
        message: expect.objectContaining({
          id: firstMessage.body.data.id,
          contentState: "masked",
        }),
      }),
    ]);
    expect(queue.body.data.items[0].message).not.toHaveProperty("content");

    await request(app.getHttpServer())
      .patch(`/api/admin/moderation/reports/${report.body.data.id}/resolve`)
      .set("authorization", `Bearer ${admin.accessToken}`)
      .send({
        action: "delete_message",
        note: "Confirmed abusive content and removed the message.",
        evidenceAuditId: crypto.randomUUID(),
      })
      .expect(403);

    const evidence = await request(app.getHttpServer())
      .post(`/api/admin/messages/${firstMessage.body.data.id}/reveal`)
      .set("authorization", `Bearer ${admin.accessToken}`)
      .send({
        reason: "abuse_investigation",
        justification: `Reviewing moderation report ${report.body.data.id}.`,
      })
      .expect(201);
    const resolved = await request(app.getHttpServer())
      .patch(`/api/admin/moderation/reports/${report.body.data.id}/resolve`)
      .set("authorization", `Bearer ${admin.accessToken}`)
      .send({
        action: "delete_message",
        note: "Confirmed abusive content and removed the message.",
        evidenceAuditId: evidence.body.data.auditId,
      })
      .expect(200);
    expect(resolved.body.data).toMatchObject({
      status: "resolved",
      resolutionAction: "delete_message",
      reviewedByAdmin: { id: admin.user.id },
      message: { contentState: "deleted" },
    });

    const secondMessage = await request(app.getHttpServer())
      .post(`/api/conversations/${direct.body.data.id}/messages`)
      .set("authorization", `Bearer ${sender.accessToken}`)
      .send({
        content: "Second reported message",
        clientMessageId: crypto.randomUUID(),
      })
      .expect(201);
    const suspensionReport = await request(app.getHttpServer())
      .post("/api/message-reports")
      .set("authorization", `Bearer ${reporter.accessToken}`)
      .send({
        messageId: secondMessage.body.data.id,
        reason: "violence_or_threat",
      })
      .expect(201);
    const suspensionEvidence = await request(app.getHttpServer())
      .post(`/api/admin/messages/${secondMessage.body.data.id}/reveal`)
      .set("authorization", `Bearer ${admin.accessToken}`)
      .send({
        reason: "abuse_investigation",
        justification: `Reviewing moderation report ${suspensionReport.body.data.id}.`,
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(
        `/api/admin/moderation/reports/${suspensionReport.body.data.id}/resolve`,
      )
      .set("authorization", `Bearer ${admin.accessToken}`)
      .send({
        action: "suspend_user",
        note: "Confirmed threat; temporary suspension applied.",
        evidenceAuditId: suspensionEvidence.body.data.auditId,
        suspensionHours: 1,
      })
      .expect(200);

    await request(app.getHttpServer())
      .get("/api/auth/me")
      .set("authorization", `Bearer ${sender.accessToken}`)
      .expect(401);
    await expect(
      authService.login({
        email: sender.user.email,
        password: "Password123!",
      }),
    ).rejects.toThrow(/suspended/i);
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
      isForwarded: true,
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
    expect(first.body.data.isForwarded).toBe(true);
    expect(
      history.body.data.items.filter(
        (message: { clientMessageId?: string }) =>
          message.clientMessageId === payload.clientMessageId,
      ),
    ).toHaveLength(1);
  });

  it("summarizes recent conversation activity without exposing outsiders", async () => {
    const sender = await createAuthUser("catchup_sender");
    const recipient = await createAuthUser("catchup_recipient");
    const outsider = await createAuthUser("catchup_outsider");
    const direct = await request(app.getHttpServer())
      .post("/api/conversations/direct")
      .set("authorization", `Bearer ${sender.accessToken}`)
      .send({ participantId: recipient.user.id })
      .expect(201);
    const decision = await request(app.getHttpServer())
      .post(`/api/conversations/${direct.body.data.id}/messages`)
      .set("authorization", `Bearer ${sender.accessToken}`)
      .send({
        content: "Karar: deployment bugün onaylandı.",
        clientMessageId: crypto.randomUUID(),
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/conversations/${direct.body.data.id}/messages`)
      .set("authorization", `Bearer ${recipient.accessToken}`)
      .send({
        content: "TODO: deployment testlerini teslim etmemiz gerekiyor.",
        clientMessageId: crypto.randomUUID(),
        replyToMessageId: decision.body.data.id,
      })
      .expect(201);

    const catchUp = await request(app.getHttpServer())
      .get(`/api/conversations/${direct.body.data.id}/messages/catch-up`)
      .query({ window: "2h" })
      .set("authorization", `Bearer ${recipient.accessToken}`)
      .expect(200);

    expect(catchUp.body.data).toMatchObject({
      conversationId: direct.body.data.id,
      window: "2h",
      messageCount: 2,
      participantCount: 2,
      replyCount: 1,
      truncated: false,
    });
    expect(catchUp.body.data.topics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "deployment" }),
      ]),
    );
    expect(catchUp.body.data.keyMoments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          messageId: decision.body.data.id,
          kind: "decision",
        }),
      ]),
    );

    await request(app.getHttpServer())
      .get(`/api/conversations/${direct.body.data.id}/messages/catch-up`)
      .set("authorization", `Bearer ${outsider.accessToken}`)
      .expect(404);
  });

  it("marks a conversation unread from a selected message", async () => {
    const sender = await createAuthUser("unread_sender");
    const recipient = await createAuthUser("unread_recipient");
    const direct = await request(app.getHttpServer())
      .post("/api/conversations/direct")
      .set("authorization", `Bearer ${sender.accessToken}`)
      .send({ participantId: recipient.user.id })
      .expect(201);
    const conversationId = direct.body.data.id;

    const firstMessage = await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/messages`)
      .set("authorization", `Bearer ${sender.accessToken}`)
      .send({ content: "First unread message" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/messages`)
      .set("authorization", `Bearer ${sender.accessToken}`)
      .send({ content: "Second unread message" })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/conversations/${conversationId}/read`)
      .set("authorization", `Bearer ${recipient.accessToken}`)
      .expect(200);

    const markedUnread = await request(app.getHttpServer())
      .patch(
        `/api/conversations/${conversationId}/messages/${firstMessage.body.data.id}/unread`,
      )
      .set("authorization", `Bearer ${recipient.accessToken}`)
      .expect(200);

    expect(markedUnread.body.data).toMatchObject({
      conversationId,
      unreadCount: 2,
    });

    const conversations = await request(app.getHttpServer())
      .get("/api/conversations")
      .set("authorization", `Bearer ${recipient.accessToken}`)
      .expect(200);
    const summary = conversations.body.data.items.find(
      (item: { id: string }) => item.id === conversationId,
    );
    expect(summary.unreadCount).toBe(2);
  });

  it("persists replies and rejects targets from another conversation", async () => {
    const sender = await createAuthUser("reply_sender");
    const recipient = await createAuthUser("reply_recipient");
    const outsider = await createAuthUser("reply_outsider");
    const direct = await request(app.getHttpServer())
      .post("/api/conversations/direct")
      .set("authorization", `Bearer ${sender.accessToken}`)
      .send({ participantId: recipient.user.id })
      .expect(201);
    const conversationId = direct.body.data.id;
    const original = await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/messages`)
      .set("authorization", `Bearer ${sender.accessToken}`)
      .send({ content: "Which room is the presentation in?" })
      .expect(201);

    const reply = await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/messages`)
      .set("authorization", `Bearer ${recipient.accessToken}`)
      .send({
        content: "Meeting room three.",
        replyToMessageId: original.body.data.id,
      })
      .expect(201);

    expect(reply.body.data).toMatchObject({
      replyToMessageId: original.body.data.id,
      replyTo: {
        id: original.body.data.id,
        senderId: sender.user.id,
        content: "Which room is the presentation in?",
      },
    });

    const history = await request(app.getHttpServer())
      .get(`/api/conversations/${conversationId}/messages`)
      .set("authorization", `Bearer ${sender.accessToken}`)
      .expect(200);
    expect(
      history.body.data.items.find(
        (message: { id: string }) => message.id === reply.body.data.id,
      ),
    ).toMatchObject({
      replyToMessageId: original.body.data.id,
      replyTo: {
        id: original.body.data.id,
        content: "Which room is the presentation in?",
      },
    });

    const otherDirect = await request(app.getHttpServer())
      .post("/api/conversations/direct")
      .set("authorization", `Bearer ${recipient.accessToken}`)
      .send({ participantId: outsider.user.id })
      .expect(201);
    const foreignMessage = await request(app.getHttpServer())
      .post(`/api/conversations/${otherDirect.body.data.id}/messages`)
      .set("authorization", `Bearer ${outsider.accessToken}`)
      .send({ content: "Message from another conversation" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/conversations/${conversationId}/messages`)
      .set("authorization", `Bearer ${recipient.accessToken}`)
      .send({
        content: "This reply target must be rejected",
        replyToMessageId: foreignMessage.body.data.id,
      })
      .expect(404);
  });

  it("stores attachments and restricts downloads to conversation members", async () => {
    const sender = await createAuthUser("attachment_sender");
    const recipient = await createAuthUser("attachment_recipient");
    const outsider = await createAuthUser("attachment_outsider");
    const direct = await request(app.getHttpServer())
      .post("/api/conversations/direct")
      .set("authorization", `Bearer ${sender.accessToken}`)
      .send({ participantId: recipient.user.id })
      .expect(201);
    const image = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlVQAAAAASUVORK5CYII=",
      "base64",
    );
    const created = await request(app.getHttpServer())
      .post(`/api/conversations/${direct.body.data.id}/messages/attachments`)
      .set("authorization", `Bearer ${sender.accessToken}`)
      .field("content", "Persistent release screenshot")
      .field("clientMessageId", crypto.randomUUID())
      .field("isForwarded", "true")
      .attach("files", image, {
        filename: "release.png",
        contentType: "image/png",
      })
      .expect(201);

    expect(created.body.data).toMatchObject({
      content: "Persistent release screenshot",
      isForwarded: true,
      attachments: [
        expect.objectContaining({
          fileName: "release.png",
          mimeType: "image/png",
          fileSize: image.length,
        }),
      ],
    });
    expect(created.body.data.attachments[0].data).toBeUndefined();

    const attachmentId = created.body.data.attachments[0].id;
    const history = await request(app.getHttpServer())
      .get(`/api/conversations/${direct.body.data.id}/messages`)
      .set("authorization", `Bearer ${recipient.accessToken}`)
      .expect(200);
    expect(history.body.data.items.at(-1)).toMatchObject({
      isForwarded: true,
      attachments: [expect.objectContaining({ id: attachmentId })],
    });

    const downloaded = await request(app.getHttpServer())
      .get(
        `/api/conversations/${direct.body.data.id}/attachments/${attachmentId}`,
      )
      .set("authorization", `Bearer ${recipient.accessToken}`)
      .expect("content-type", /image\/png/)
      .expect(200);
    expect(downloaded.body).toEqual(image);

    await request(app.getHttpServer())
      .get(
        `/api/conversations/${direct.body.data.id}/attachments/${attachmentId}`,
      )
      .set("authorization", `Bearer ${outsider.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/conversations/${direct.body.data.id}/messages/attachments`)
      .set("authorization", `Bearer ${sender.accessToken}`)
      .attach("files", Buffer.from("console.log('no')"), {
        filename: "script.js",
        contentType: "application/javascript",
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/conversations/${direct.body.data.id}/messages/attachments`)
      .set("authorization", `Bearer ${sender.accessToken}`)
      .attach("files", Buffer.from("not-a-real-png"), {
        filename: "spoofed.png",
        contentType: "image/png",
      })
      .expect(400);
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
    const reusedWithDifferentPayload = await request(app.getHttpServer())
      .post("/api/bot/groups")
      .set("x-bot-secret", secret)
      .send({
        ...groupPayload,
        name: "A different group name",
        participantIds: [laterMember.id],
        initialBotMessage: "This retry must not create another message.",
      })
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
    await request(app.getHttpServer())
      .post("/api/conversations/direct")
      .set("authorization", `Bearer ${member.accessToken}`)
      .send({ participantId: botUser.id })
      .expect(400);
    expect(created.body.data).toMatchObject({
      isBotManaged: true,
      memberCanSendMessages: false,
      membersCanLeave: false,
      created: true,
      reused: false,
    });
    expect(retriedCreate.body.data).toMatchObject({
      id: created.body.data.id,
      created: false,
      reused: true,
    });
    expect(reusedWithDifferentPayload.body.data).toMatchObject({
      id: created.body.data.id,
      name: groupPayload.name,
      created: false,
      reused: true,
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

    const groupDetail = await request(app.getHttpServer())
      .get(`/api/bot/groups/${created.body.data.id}`)
      .set("x-bot-secret", secret)
      .expect(200);
    const listedParticipants = await request(app.getHttpServer())
      .get(`/api/bot/groups/${created.body.data.id}/participants`)
      .set("x-bot-secret", secret)
      .expect(200);

    expect(groupDetail.body.data).toMatchObject({
      id: created.body.data.id,
      externalRef: groupPayload.externalRef,
      status: "active",
      isBotManaged: true,
    });
    expect(listedParticipants.body.data).toHaveLength(
      created.body.data.participants.length,
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

    const memberMessage = await request(app.getHttpServer())
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
    const updatedMessage = await request(app.getHttpServer())
      .patch(
        `/api/bot/groups/${created.body.data.id}/messages/${message.body.data.id}`,
      )
      .set("x-bot-secret", secret)
      .send({ content: "Severity corrected to high." })
      .expect(200);

    expect(updatedMessage.body.data).toMatchObject({
      id: message.body.data.id,
      senderId: botUser.id,
      content: "Severity corrected to high.",
    });

    await request(app.getHttpServer())
      .patch(
        `/api/bot/groups/${created.body.data.id}/messages/${memberMessage.body.data.id}`,
      )
      .set("x-bot-secret", secret)
      .send({ content: "The bot cannot edit a member message." })
      .expect(403);

    const deletedMessage = await request(app.getHttpServer())
      .delete(
        `/api/bot/groups/${created.body.data.id}/messages/${message.body.data.id}`,
      )
      .set("x-bot-secret", secret)
      .expect(200);

    expect(deletedMessage.body.data).toMatchObject({
      id: message.body.data.id,
      content: "",
    });
    expect(deletedMessage.body.data.deletedAt).toEqual(expect.any(String));

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
    expect(
      history.body.data.items.filter(
        (item: { content: string }) =>
          item.content === "This retry must not create another message.",
      ),
    ).toHaveLength(0);

    const remainingParticipants = await request(app.getHttpServer())
      .delete(
        `/api/bot/groups/${created.body.data.id}/participants/${laterMember.id}`,
      )
      .set("x-bot-secret", secret)
      .expect(200);

    expect(
      remainingParticipants.body.data.some(
        (participant: { userId: string }) =>
          participant.userId === laterMember.id,
      ),
    ).toBe(false);

    const closed = await request(app.getHttpServer())
      .patch(`/api/bot/groups/${created.body.data.id}`)
      .set("x-bot-secret", secret)
      .send({ status: "closed" })
      .expect(200);
    expect(closed.body.data.status).toBe("closed");

    await request(app.getHttpServer())
      .post(`/api/bot/groups/${created.body.data.id}/messages`)
      .set("x-bot-secret", secret)
      .send({ content: "Closed groups reject new messages." })
      .expect(403);

    const reopened = await request(app.getHttpServer())
      .patch(`/api/bot/groups/${created.body.data.id}`)
      .set("x-bot-secret", secret)
      .send({ status: "active" })
      .expect(200);
    expect(reopened.body.data.status).toBe("active");

    const archived = await request(app.getHttpServer())
      .patch(`/api/bot/groups/${created.body.data.id}`)
      .set("x-bot-secret", secret)
      .send({ status: "archived" })
      .expect(200);
    expect(archived.body.data.status).toBe("archived");

    await request(app.getHttpServer())
      .patch(`/api/bot/groups/${created.body.data.id}`)
      .set("x-bot-secret", secret)
      .send({ status: "active" })
      .expect(200);

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
    await request(app.getHttpServer())
      .delete(
        `/api/bot/groups/${created.body.data.id}/participants/${botUser.id}`,
      )
      .set("x-bot-secret", secret)
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
    await request(app.getHttpServer())
      .get(`/api/bot/groups/${regularGroup.body.data.id}`)
      .set("x-bot-secret", secret)
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
