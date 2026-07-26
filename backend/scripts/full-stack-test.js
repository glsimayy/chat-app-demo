const path = require("node:path");

require("dotenv").config({
  path: path.resolve(__dirname, "..", "..", ".env"),
  quiet: true,
});

const { io } = require("socket.io-client");

const FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL ?? "http://localhost:5173";
const API_BASE_URL = process.env.API_BASE_URL ?? `${FRONTEND_BASE_URL}/api`;
const SOCKET_URL = process.env.SOCKET_URL ?? `${FRONTEND_BASE_URL}/chat`;
const JAVA_BASE_URL = process.env.JAVA_BASE_URL ?? "http://localhost:8080";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "emiradmin@ello.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "123456";
const WEBHOOK_SECRET =
  process.env.WEBHOOK_SECRET ??
  "local-compose-incoming-secret-change-before-production";
const TEST_PASSWORD =
  process.env.FULL_STACK_TEST_PASSWORD ?? "FullStackTest123!";

const TEST_USERS = [
  {
    email: "fullstack-user1@ello.local",
    username: "fullstack_user1",
    password: TEST_PASSWORD,
  },
  {
    email: "fullstack-user2@ello.local",
    username: "fullstack_user2",
    password: TEST_PASSWORD,
  },
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function request(method, url, options = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  return {
    status: response.status,
    ok: response.ok,
    headers: response.headers,
    payload,
    data:
      payload && typeof payload === "object" && "data" in payload
        ? payload.data
        : payload,
  };
}

async function expectRequest(method, url, options = {}, statuses = [200, 201]) {
  const response = await request(method, url, options);

  if (!statuses.includes(response.status)) {
    throw new Error(
      `${method} ${url} returned ${response.status}: ${JSON.stringify(response.payload)}`,
    );
  }

  return response;
}

async function waitForHttp(url, timeoutMilliseconds = 90_000) {
  const deadline = Date.now() + timeoutMilliseconds;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {}

    await delay(500);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function login(email, password) {
  return request("POST", `${API_BASE_URL}/auth/login`, {
    body: { email, password },
  });
}

async function ensureTestUser(user) {
  const existingLogin = await login(user.email, user.password);

  if (existingLogin.ok) {
    return existingLogin.data;
  }

  assert(
    existingLogin.status === 401,
    `Unexpected login response for ${user.email}: ${existingLogin.status}`,
  );

  const registration = await request("POST", `${API_BASE_URL}/auth/register`, {
    body: user,
  });

  if (registration.status === 409) {
    throw new Error(
      `${user.email} already exists with a different password. Set FULL_STACK_TEST_PASSWORD to its password or remove that test user.`,
    );
  }

  assert(
    registration.status === 201,
    `Could not create ${user.email}: ${JSON.stringify(registration.payload)}`,
  );

  return registration.data;
}

function waitForSocketEvent(
  socket,
  eventName,
  predicate = () => true,
  timeoutMilliseconds = 8_000,
) {
  return new Promise((resolve, reject) => {
    const handler = (payload) => {
      if (!predicate(payload)) {
        return;
      }

      clearTimeout(timeout);
      socket.off(eventName, handler);
      resolve(payload);
    };
    const timeout = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMilliseconds);

    socket.on(eventName, handler);
  });
}

function expectNoSocketEvent(
  socket,
  eventName,
  predicate = () => true,
  timeoutMilliseconds = 800,
) {
  return new Promise((resolve, reject) => {
    const handler = (payload) => {
      if (!predicate(payload)) {
        return;
      }

      clearTimeout(timeout);
      socket.off(eventName, handler);
      reject(new Error(`Unexpected ${eventName}: ${JSON.stringify(payload)}`));
    };
    const timeout = setTimeout(() => {
      socket.off(eventName, handler);
      resolve();
    }, timeoutMilliseconds);

    socket.on(eventName, handler);
  });
}

function emitWithAck(socket, eventName, payload, timeoutMilliseconds = 8_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${eventName} ACK`)),
      timeoutMilliseconds,
    );

    socket.emit(eventName, payload, (response) => {
      clearTimeout(timeout);
      resolve(response);
    });
  });
}

async function connectSocket(token) {
  const socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket"],
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`Timed out connecting to ${SOCKET_URL}`));
    }, 8_000);

    socket.once("connect", () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  return socket;
}

async function syncConversation(socket, conversationId) {
  const response = await emitWithAck(socket, "conversation:sync", {
    conversationIds: [conversationId],
  });
  assert(response?.success === true, `Could not sync ${conversationId}`);
}

async function main() {
  await waitForHttp(`${FRONTEND_BASE_URL}/healthz`);
  await waitForHttp(`${API_BASE_URL}/health`);
  await waitForHttp(`${JAVA_BASE_URL}/health`);
  await waitForHttp(`${JAVA_BASE_URL}/ready`);

  const frontend = await expectRequest("GET", FRONTEND_BASE_URL);
  assert(
    frontend.headers.get("content-type")?.includes("text/html"),
    "Frontend did not return HTML",
  );

  const swagger = await expectRequest("GET", `${API_BASE_URL}/docs`);
  assert(
    swagger.headers.get("content-type")?.includes("text/html"),
    "Swagger UI did not return HTML",
  );
  const swaggerJson = await expectRequest("GET", `${API_BASE_URL}/docs-json`);
  assert(swaggerJson.data?.openapi, "Swagger JSON is missing OpenAPI metadata");

  const adminLogin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  assert(
    adminLogin.ok,
    `ADMIN login failed for ${ADMIN_EMAIL}: ${JSON.stringify(adminLogin.payload)}`,
  );
  assert(adminLogin.data.user.role === "admin", "ADMIN role is incorrect");

  const user1 = await ensureTestUser(TEST_USERS[0]);
  const user2 = await ensureTestUser(TEST_USERS[1]);
  assert(user1.user.role === "user", "First test user role is incorrect");
  assert(user2.user.role === "user", "Second test user role is incorrect");

  const ticketSubject = `Full-stack support ${crypto.randomUUID()}`;
  const createdTicket = await expectRequest("POST", `${API_BASE_URL}/tickets`, {
    token: user1.accessToken,
    body: {
      subject: ticketSubject,
      message: "This ticket verifies the complete support request flow.",
      priority: "high",
    },
  });
  assert(createdTicket.data.status === "open", "New ticket is not open");

  const otherUsersTickets = await expectRequest(
    "GET",
    `${API_BASE_URL}/tickets?search=${encodeURIComponent(ticketSubject)}`,
    { token: user2.accessToken },
  );
  assert(
    otherUsersTickets.data.items.length === 0,
    "Regular user could see another user's ticket",
  );

  const forbiddenTicketUpdate = await request(
    "PATCH",
    `${API_BASE_URL}/tickets/${createdTicket.data.id}`,
    {
      token: user1.accessToken,
      body: {
        expectedVersion: createdTicket.data.version,
        status: "resolved",
      },
    },
  );
  assert(
    forbiddenTicketUpdate.status === 403,
    "Regular user unexpectedly updated a ticket",
  );

  const adminTickets = await expectRequest(
    "GET",
    `${API_BASE_URL}/tickets?search=${encodeURIComponent(ticketSubject)}`,
    { token: adminLogin.data.accessToken },
  );
  assert(
    adminTickets.data.items.some(
      (ticket) => ticket.id === createdTicket.data.id,
    ),
    "Admin could not find the new support ticket",
  );

  const claimedTicket = await expectRequest(
    "POST",
    `${API_BASE_URL}/tickets/${createdTicket.data.id}/claim`,
    {
      token: adminLogin.data.accessToken,
      body: { expectedVersion: createdTicket.data.version },
    },
  );
  assert(
    claimedTicket.data.assignedAdminId === adminLogin.data.user.id &&
      claimedTicket.data.version === createdTicket.data.version + 1,
    "Admin could not claim the support ticket",
  );

  const resolvedTicket = await expectRequest(
    "PATCH",
    `${API_BASE_URL}/tickets/${createdTicket.data.id}`,
    {
      token: adminLogin.data.accessToken,
      body: {
        expectedVersion: claimedTicket.data.version,
        status: "resolved",
        adminNote: "Full-stack support flow verified.",
      },
    },
  );
  assert(
    resolvedTicket.data.status === "resolved" &&
      resolvedTicket.data.adminNote === "Full-stack support flow verified.",
    "Admin ticket resolution was not persisted",
  );
  assert(
    resolvedTicket.data.activities.some(
      (activity) =>
        activity.action === "assigned" &&
        activity.actorId === adminLogin.data.user.id,
    ),
    "Ticket assignment activity was not persisted",
  );

  const staleTicketUpdate = await request(
    "PATCH",
    `${API_BASE_URL}/tickets/${createdTicket.data.id}`,
    {
      token: adminLogin.data.accessToken,
      body: {
        expectedVersion: claimedTicket.data.version,
        status: "in_progress",
      },
    },
  );
  assert(
    staleTicketUpdate.status === 409,
    "Stale ticket update did not return 409 Conflict",
  );

  const requesterTickets = await expectRequest(
    "GET",
    `${API_BASE_URL}/tickets?search=${encodeURIComponent(ticketSubject)}`,
    { token: user1.accessToken },
  );
  assert(
    requesterTickets.data.items[0]?.status === "resolved",
    "Requester could not see the resolved ticket",
  );

  const forbiddenGroup = await request(
    "POST",
    `${API_BASE_URL}/conversations/groups`,
    {
      token: user1.accessToken,
      body: {
        name: "Full Stack User Group Must Fail",
        participantIds: [user2.user.id],
      },
    },
  );
  assert(
    forbiddenGroup.status === 403,
    "Regular user unexpectedly created a manual group",
  );

  const direct = await expectRequest(
    "POST",
    `${API_BASE_URL}/conversations/direct`,
    {
      token: adminLogin.data.accessToken,
      body: { participantId: user1.user.id },
    },
  );

  const adminSocket = await connectSocket(adminLogin.data.accessToken);
  const user1Socket = await connectSocket(user1.accessToken);

  try {
    await syncConversation(adminSocket, direct.data.id);
    await syncConversation(user1Socket, direct.data.id);

    const directClientMessageId = crypto.randomUUID();
    const directContent = `full-stack direct ${directClientMessageId}`;
    const directEventPromise = waitForSocketEvent(
      user1Socket,
      "message:new",
      (message) => message?.clientMessageId === directClientMessageId,
    );
    const directAck = await emitWithAck(adminSocket, "message:send", {
      conversationId: direct.data.id,
      content: directContent,
      clientMessageId: directClientMessageId,
    });
    const directEvent = await directEventPromise;
    assert(directAck?.success === true, "Direct message ACK failed");
    assert(
      directEvent.content === directContent,
      "Direct realtime delivery failed",
    );

    const duplicatePromise = expectNoSocketEvent(
      user1Socket,
      "message:new",
      (message) => message?.clientMessageId === directClientMessageId,
    );
    const duplicateAck = await emitWithAck(adminSocket, "message:send", {
      conversationId: direct.data.id,
      content: directContent,
      clientMessageId: directClientMessageId,
    });
    assert(
      duplicateAck?.data?.id === directAck.data.id,
      "Direct message retry was not idempotent",
    );
    await duplicatePromise;

    const attachmentClientMessageId = crypto.randomUUID();
    const attachmentBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlVQAAAAASUVORK5CYII=",
      "base64",
    );
    const attachmentEventPromise = waitForSocketEvent(
      user1Socket,
      "message:new",
      (message) => message?.clientMessageId === attachmentClientMessageId,
    );
    const attachmentForm = new FormData();
    attachmentForm.append("content", "Full-stack persistent attachment");
    attachmentForm.append("clientMessageId", attachmentClientMessageId);
    attachmentForm.append(
      "files",
      new Blob([attachmentBytes], { type: "image/png" }),
      "full-stack.png",
    );
    const attachmentUpload = await fetch(
      `${API_BASE_URL}/conversations/${direct.data.id}/messages/attachments`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${adminLogin.data.accessToken}`,
        },
        body: attachmentForm,
      },
    );
    const attachmentPayload = await attachmentUpload.json();
    assert(
      attachmentUpload.status === 201,
      `Attachment upload failed: ${JSON.stringify(attachmentPayload)}`,
    );
    const attachmentMessage = attachmentPayload.data;
    const attachmentEvent = await attachmentEventPromise;
    assert(
      attachmentEvent.attachments?.[0]?.fileName === "full-stack.png",
      "Attachment message was not delivered in realtime",
    );
    assert(
      attachmentMessage.attachments?.[0]?.data === undefined,
      "Attachment binary leaked into the message response",
    );
    const attachmentDownload = await fetch(
      `${API_BASE_URL}/conversations/${direct.data.id}/attachments/${attachmentMessage.attachments[0].id}`,
      {
        headers: { authorization: `Bearer ${user1.accessToken}` },
      },
    );
    const downloadedAttachment = Buffer.from(
      await attachmentDownload.arrayBuffer(),
    );
    assert(
      attachmentDownload.ok && downloadedAttachment.equals(attachmentBytes),
      "Stored attachment could not be downloaded by the recipient",
    );

    const ticketId = `FULLSTACK-${crypto.randomUUID()}`;
    const webhookPayload = {
      eventType: "ticket.created",
      ticketId,
      ownerId: adminLogin.data.user.id,
      title: `Full Stack Ticket ${ticketId.slice(-8)}`,
      participantIds: [user1.user.id, user2.user.id],
    };
    const unauthorizedWebhook = await request(
      "POST",
      `${JAVA_BASE_URL}/webhook/ticket-created`,
      {
        headers: { "X-Webhook-Token": "invalid-full-stack-secret" },
        body: webhookPayload,
      },
    );
    assert(
      unauthorizedWebhook.status === 401,
      "Java webhook accepted an invalid secret",
    );

    const webhook = await expectRequest(
      "POST",
      `${JAVA_BASE_URL}/webhook/ticket-created`,
      {
        headers: { "X-Webhook-Token": WEBHOOK_SECRET },
        body: webhookPayload,
      },
    );
    const repeatedWebhook = await expectRequest(
      "POST",
      `${JAVA_BASE_URL}/webhook/ticket-created`,
      {
        headers: { "X-Webhook-Token": WEBHOOK_SECRET },
        body: webhookPayload,
      },
    );
    assert(webhook.data.id, "Webhook did not return a conversation");
    assert(
      repeatedWebhook.data.id === webhook.data.id,
      "Repeated ticket webhook created a duplicate group",
    );

    await syncConversation(adminSocket, webhook.data.id);
    await syncConversation(user1Socket, webhook.data.id);

    const deniedMemberAck = await emitWithAck(user1Socket, "message:send", {
      conversationId: webhook.data.id,
      content: "member message must be rejected",
      clientMessageId: crypto.randomUUID(),
    });
    assert(
      deniedMemberAck?.success === false,
      "Read-only automation group accepted a member message",
    );

    const groupClientMessageId = crypto.randomUUID();
    const groupContent = `full-stack group ${groupClientMessageId}`;
    const groupEventPromise = waitForSocketEvent(
      user1Socket,
      "message:new",
      (message) => message?.clientMessageId === groupClientMessageId,
    );
    const groupAck = await emitWithAck(adminSocket, "message:send", {
      conversationId: webhook.data.id,
      content: groupContent,
      clientMessageId: groupClientMessageId,
    });
    const groupEvent = await groupEventPromise;
    assert(groupAck?.success === true, "Group message ACK failed");
    assert(
      groupEvent.content === groupContent,
      "Group realtime delivery failed",
    );

    const groupMessages = await expectRequest(
      "GET",
      `${API_BASE_URL}/conversations/${webhook.data.id}/messages?limit=50`,
      { token: adminLogin.data.accessToken },
    );
    assert(
      groupMessages.data.items.filter(
        (message) =>
          message.content === `Ticket ${ticketId} created via webhook`,
      ).length === 1,
      "Webhook retry duplicated the initial bot message",
    );
    assert(
      groupMessages.data.items.some(
        (message) => message.clientMessageId === groupClientMessageId,
      ),
      "Group message was not persisted",
    );
  } finally {
    adminSocket.disconnect();
    user1Socket.disconnect();
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        checked: [
          "frontend and same-origin API proxy",
          "backend health",
          "Swagger UI and OpenAPI JSON",
          "Java health and readiness",
          "ADMIN login and roles",
          "idempotent test user provisioning",
          "regular user authorization boundary",
          "support ticket assignment, conflict protection and admin resolution",
          "direct Socket.IO delivery and retry idempotency",
          "persistent attachment upload, realtime delivery and download",
          "Java webhook authentication",
          "ticket webhook group idempotency",
          "read-only automation group policy",
          "group Socket.IO delivery and persistence",
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
