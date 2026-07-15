require("dotenv").config({ quiet: true });

const { io } = require("socket.io-client");

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000/api";
const SOCKET_URL = process.env.SOCKET_URL ?? "http://localhost:3000/chat";
const BOT_WEBHOOK_SECRET = process.env.BOT_WEBHOOK_SECRET ?? "dev-bot-secret";
const DEV_RESET_SECRET =
  process.env.DEV_RESET_SECRET ?? "change-me-for-dev-reset";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(method, path, body, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.botSecret ? { "x-bot-secret": options.botSecret } : {}),
      ...(options.devSecret ? { "x-dev-secret": options.devSecret } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json();

  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${JSON.stringify(json)}`);
  }

  return json.data;
}

async function requestExpectError(method, path, body, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.botSecret ? { "x-bot-secret": options.botSecret } : {}),
      ...(options.devSecret ? { "x-dev-secret": options.devSecret } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.ok) {
    throw new Error(`${method} ${path} unexpectedly succeeded`);
  }

  return response.status;
}

function emitWithAck(socket, eventName, payload) {
  return new Promise((resolve) => socket.emit(eventName, payload, resolve));
}

function waitFor(socket, eventName, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, 5000);

    const handler = (payload) => {
      if (!predicate(payload)) {
        return;
      }

      clearTimeout(timeout);
      socket.off(eventName, handler);
      resolve(payload);
    };

    socket.on(eventName, handler);
  });
}

function expectNoEvent(socket, eventName, predicate = () => true) {
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
    }, 750);

    socket.on(eventName, handler);
  });
}

async function connectSocket(token) {
  const socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket"],
  });

  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });

  return socket;
}

async function register(prefix, stamp) {
  return request("POST", "/auth/register", {
    email: `${prefix}_${stamp}@test.local`,
    username: `${prefix}_${stamp}`,
    password: "Password123!",
  });
}

async function main() {
  const stamp = crypto.randomUUID().slice(0, 8);
  const health = await request("GET", "/health");
  assert(health.status === "ok", "Health check did not return ok");

  const resetStatus = await requestExpectError("POST", "/dev/reset");
  assert(
    resetStatus === 403,
    "Dev reset must reject requests without a secret",
  );
  await request("POST", "/dev/reset", undefined, {
    devSecret: DEV_RESET_SECRET,
  });

  const alpha = await register("smoke_alpha", stamp);
  const beta = await register("smoke_beta", stamp);
  const gamma = await register("smoke_gamma", stamp);
  assert(
    alpha.user.role === "admin",
    "First local registration must create the demo admin",
  );
  assert(beta.user.role === "user", "Later registrations must create users");
  assert(gamma.user.role === "user", "Later registrations must create users");

  const me = await request("GET", "/auth/me", undefined, {
    token: alpha.accessToken,
  });
  assert(me.id === alpha.user.id, "auth/me returned the wrong user");
  const betaProfile = await request(
    "GET",
    `/users/${beta.user.id}`,
    undefined,
    { token: alpha.accessToken },
  );
  assert(betaProfile.id === beta.user.id, "User profile endpoint failed");

  const regularUserGroupStatus = await requestExpectError(
    "POST",
    "/conversations/groups",
    {
      name: "Regular User Group Must Fail",
      participantIds: [alpha.user.id],
    },
    { token: beta.accessToken },
  );
  assert(
    regularUserGroupStatus === 403,
    "Regular users must not create manual groups",
  );

  const changedPassword = await request(
    "PATCH",
    "/auth/password",
    {
      currentPassword: "Password123!",
      newPassword: "NewPassword123!",
    },
    { token: alpha.accessToken },
  );
  assert(
    changedPassword.user.id === alpha.user.id,
    "Password change returned the wrong user",
  );
  const oldPasswordStatus = await requestExpectError("POST", "/auth/login", {
    email: alpha.user.email,
    password: "Password123!",
  });
  assert(oldPasswordStatus === 401, "Old password should fail after change");
  const alphaLogin = await request("POST", "/auth/login", {
    email: alpha.user.email,
    password: "NewPassword123!",
  });
  alpha.accessToken = alphaLogin.accessToken;

  const directConversation = await request(
    "POST",
    "/conversations/direct",
    { participantId: beta.user.id },
    { token: alpha.accessToken },
  );

  for (const content of ["smoke-1", "smoke-2", "smoke-3"]) {
    await request(
      "POST",
      `/conversations/${directConversation.id}/messages`,
      { content },
      { token: alpha.accessToken },
    );
  }

  const conversationsPage = await request(
    "GET",
    `/conversations?type=direct&search=${beta.user.username}&limit=10`,
    undefined,
    { token: alpha.accessToken },
  );
  assert(
    conversationsPage.items.some(
      (conversation) => conversation.id === directConversation.id,
    ),
    "Conversation filtering did not return direct conversation",
  );

  const page = await request(
    "GET",
    `/conversations/${directConversation.id}/messages?limit=2`,
    undefined,
    { token: alpha.accessToken },
  );
  assert(page.items.length === 2, "Message pagination did not return 2 items");
  assert(page.pageInfo.hasMore === true, "Message pagination hasMore failed");

  const messageSearch = await request(
    "GET",
    `/conversations/${directConversation.id}/messages/search?q=smoke-2`,
    undefined,
    { token: alpha.accessToken },
  );
  assert(
    messageSearch.items.some((message) => message.content === "smoke-2"),
    "Message search did not return expected message",
  );

  const alphaSocket = await connectSocket(alpha.accessToken);
  let betaSocket = await connectSocket(beta.accessToken);

  try {
    const unopenedMessagePromise = waitFor(
      betaSocket,
      "message:new",
      (message) => message?.content === "smoke unopened conversation",
    );
    const unopenedMessage = await request(
      "POST",
      `/conversations/${directConversation.id}/messages`,
      { content: "smoke unopened conversation" },
      { token: alpha.accessToken },
    );
    const unopenedMessageEvent = await unopenedMessagePromise;
    assert(
      unopenedMessageEvent.id === unopenedMessage.id,
      "Unopened conversation did not receive message:new",
    );

    const alphaSnapshotPromise = waitFor(alphaSocket, "presence:snapshot");
    await emitWithAck(alphaSocket, "conversation:join", {
      conversationId: directConversation.id,
    });
    const alphaSnapshot = await alphaSnapshotPromise;
    assert(
      alphaSnapshot.users.some(
        (item) => item.userId === alpha.user.id && item.online === true,
      ),
      "Presence snapshot did not include alpha as online",
    );

    const betaOnlinePromise = waitFor(alphaSocket, "presence:online");
    const betaSnapshotPromise = waitFor(betaSocket, "presence:snapshot");
    await emitWithAck(betaSocket, "conversation:join", {
      conversationId: directConversation.id,
    });
    const betaOnline = await betaOnlinePromise;
    const betaSnapshot = await betaSnapshotPromise;
    assert(
      betaOnline.userId === beta.user.id,
      "presence:online did not include beta",
    );
    assert(
      betaSnapshot.users.some(
        (item) => item.userId === alpha.user.id && item.online === true,
      ),
      "Presence snapshot did not include alpha for beta",
    );

    const newMessagePromise = waitFor(betaSocket, "message:new");
    const socketClientMessageId = crypto.randomUUID();
    const sent = await emitWithAck(alphaSocket, "message:send", {
      conversationId: directConversation.id,
      content: "smoke socket message",
      clientMessageId: socketClientMessageId,
    });
    const newMessage = await newMessagePromise;

    assert(sent.success === true, "Socket message send ack failed");
    assert(
      newMessage.content === "smoke socket message",
      "Socket message:new payload failed",
    );
    const duplicateMessagePromise = expectNoEvent(
      betaSocket,
      "message:new",
      (message) => message?.clientMessageId === socketClientMessageId,
    );
    const duplicateAck = await emitWithAck(alphaSocket, "message:send", {
      conversationId: directConversation.id,
      content: "smoke socket message",
      clientMessageId: socketClientMessageId,
    });
    assert(
      duplicateAck.data.id === sent.data.id,
      "Socket message retry was not deduplicated",
    );
    await duplicateMessagePromise;

    const validationErrorAck = await emitWithAck(alphaSocket, "message:send", {
      conversationId: directConversation.id,
      content: "x".repeat(2001),
    });
    assert(
      validationErrorAck.success === false &&
        validationErrorAck.code === "VALIDATION_ERROR",
      "Socket validation error ack was not standardized",
    );

    const updatePromise = waitFor(betaSocket, "message:updated");
    await emitWithAck(alphaSocket, "message:update", {
      conversationId: directConversation.id,
      messageId: sent.data.id,
      content: "smoke socket message edited",
    });
    const updatedMessage = await updatePromise;
    assert(
      updatedMessage.content === "smoke socket message edited",
      "Socket message:updated payload failed",
    );

    const deletePromise = waitFor(betaSocket, "message:deleted");
    await emitWithAck(alphaSocket, "message:delete", {
      conversationId: directConversation.id,
      messageId: sent.data.id,
    });
    const deletedMessage = await deletePromise;
    assert(Boolean(deletedMessage.deletedAt), "Socket message delete failed");

    const restUpdatePromise = waitFor(
      betaSocket,
      "message:updated",
      (message) => message?.id === unopenedMessage.id,
    );
    const restUpdatedMessage = await request(
      "PATCH",
      `/conversations/${directConversation.id}/messages/${unopenedMessage.id}`,
      { content: "smoke REST message edited" },
      { token: alpha.accessToken },
    );
    const restUpdateEvent = await restUpdatePromise;
    assert(
      restUpdateEvent.content === restUpdatedMessage.content,
      "REST message update was not broadcast",
    );

    const restDeletePromise = waitFor(
      betaSocket,
      "message:deleted",
      (message) => message?.id === unopenedMessage.id,
    );
    await request(
      "DELETE",
      `/conversations/${directConversation.id}/messages/${unopenedMessage.id}`,
      undefined,
      { token: alpha.accessToken },
    );
    const restDeleteEvent = await restDeletePromise;
    assert(
      Boolean(restDeleteEvent.deletedAt),
      "REST message delete was not broadcast",
    );

    const reconnectOfflinePromise = waitFor(alphaSocket, "presence:offline");
    betaSocket.disconnect();
    await reconnectOfflinePromise;
    betaSocket = await connectSocket(beta.accessToken);
    const syncedPromise = waitFor(betaSocket, "conversation:synced");
    const syncAck = await emitWithAck(betaSocket, "conversation:sync", {
      conversationIds: [directConversation.id],
    });
    const synced = await syncedPromise;
    assert(syncAck.success === true, "Reconnect sync ack failed");
    assert(
      synced.conversationIds.includes(directConversation.id),
      "Reconnect did not sync active conversation",
    );
    const typingAfterReconnectPromise = waitFor(betaSocket, "typing:started");
    await emitWithAck(alphaSocket, "typing:start", {
      conversationId: directConversation.id,
    });
    const typingAfterReconnect = await typingAfterReconnectPromise;
    assert(
      typingAfterReconnect.userId === alpha.user.id,
      "Reconnected socket did not rejoin the conversation room",
    );

    const removalGroup = await request(
      "POST",
      "/conversations/groups",
      {
        name: "Smoke Removal Group",
        participantIds: [beta.user.id],
      },
      { token: alpha.accessToken },
    );
    const participantAddedPromise = waitFor(
      betaSocket,
      "participant:added",
      (event) =>
        event?.conversationId === removalGroup.id &&
        event?.userId === gamma.user.id,
    );
    const participantSystemMessagePromise = waitFor(
      betaSocket,
      "message:new",
      (message) =>
        message?.conversationId === removalGroup.id &&
        message?.messageType === "system" &&
        message?.content?.includes(gamma.user.username),
    );
    await request(
      "POST",
      `/conversations/${removalGroup.id}/participants`,
      { userId: gamma.user.id },
      { token: alpha.accessToken },
    );
    await participantAddedPromise;
    await participantSystemMessagePromise;

    const betaGroupSnapshotPromise = waitFor(
      betaSocket,
      "presence:snapshot",
      (snapshot) => snapshot?.conversationId === removalGroup.id,
    );
    await emitWithAck(betaSocket, "conversation:join", {
      conversationId: removalGroup.id,
    });
    await betaGroupSnapshotPromise;

    const removedPromise = waitFor(
      betaSocket,
      "conversation:left",
      (event) => event?.conversationId === removalGroup.id,
    );
    const participantRemovedPromise = waitFor(
      alphaSocket,
      "participant:removed",
      (event) =>
        event?.conversationId === removalGroup.id &&
        event?.userId === beta.user.id,
    );
    await request(
      "DELETE",
      `/conversations/${removalGroup.id}/participants/${beta.user.id}`,
      undefined,
      { token: alpha.accessToken },
    );
    await removedPromise;
    await participantRemovedPromise;

    const removedUserMessagePromise = expectNoEvent(
      betaSocket,
      "message:new",
      (message) => message?.conversationId === removalGroup.id,
    );
    await request(
      "POST",
      `/conversations/${removalGroup.id}/messages`,
      { content: "removed user must not receive this" },
      { token: alpha.accessToken },
    );
    await removedUserMessagePromise;

    const betaOfflinePromise = waitFor(alphaSocket, "presence:offline");
    betaSocket.disconnect();
    const betaOffline = await betaOfflinePromise;
    assert(
      betaOffline.userId === beta.user.id,
      "presence:offline did not include beta",
    );
  } finally {
    alphaSocket.disconnect();
    betaSocket.disconnect();
  }

  const botGroupPayload = {
    ownerId: alpha.user.id,
    name: "Smoke Bot Group",
    participantIds: [beta.user.id],
    externalRef: `smoke-${stamp}`,
    initialSystemMessage: "Smoke bot group is ready.",
  };
  const botGroup = await request("POST", "/bot/create-group", botGroupPayload, {
    botSecret: BOT_WEBHOOK_SECRET,
  });
  assert(botGroup.type === "group", "Bot group create failed");
  const repeatedBotGroup = await request(
    "POST",
    "/bot/create-group",
    botGroupPayload,
    { botSecret: BOT_WEBHOOK_SECRET },
  );
  assert(
    repeatedBotGroup.id === botGroup.id,
    "Repeated bot webhook created a duplicate group",
  );
  const botMessages = await request(
    "GET",
    `/conversations/${botGroup.id}/messages?limit=50`,
    undefined,
    { token: alpha.accessToken },
  );
  assert(
    botMessages.items.filter(
      (message) => message.content === botGroupPayload.initialSystemMessage,
    ).length === 1,
    "Repeated bot webhook duplicated the initial system message",
  );

  const renamedGroup = await request(
    "PATCH",
    `/conversations/${botGroup.id}`,
    { name: "Smoke Bot Group Renamed" },
    { token: alpha.accessToken },
  );
  assert(
    renamedGroup.name === "Smoke Bot Group Renamed",
    "Group rename failed",
  );

  const ownerLeaveStatus = await requestExpectError(
    "POST",
    `/conversations/${botGroup.id}/leave`,
    undefined,
    { token: alpha.accessToken },
  );
  assert(ownerLeaveStatus === 400, "Group owner leave should fail");

  const ownershipTransferred = await request(
    "PATCH",
    `/conversations/${botGroup.id}/owner`,
    { userId: beta.user.id },
    { token: alpha.accessToken },
  );
  assert(
    ownershipTransferred.participants.some(
      (participant) =>
        participant.userId === beta.user.id && participant.role === "owner",
    ),
    "Group owner transfer failed",
  );

  const leftGroup = await request(
    "POST",
    `/conversations/${botGroup.id}/leave`,
    undefined,
    { token: alpha.accessToken },
  );
  assert(leftGroup.userId === alpha.user.id, "Group member leave failed");

  console.log(
    JSON.stringify(
      {
        ok: true,
        apiBaseUrl: API_BASE_URL,
        socketUrl: SOCKET_URL,
        checked: [
          "health",
          "auth",
          "local admin bootstrap and registration role safety",
          "protected dev reset",
          "user profile",
          "admin-only manual group creation",
          "change password",
          "direct conversations",
          "conversation filtering",
          "message pagination",
          "message search",
          "unopened conversation realtime delivery",
          "socket message send/update/delete",
          "socket message retry idempotency",
          "standard socket success and error ACKs",
          "socket reconnect conversation sync",
          "socket payload validation",
          "REST message update/delete broadcast",
          "removed participant room eviction",
          "participant added/removed events",
          "realtime system messages",
          "socket presence",
          "idempotent bot group create",
          "group rename",
          "group owner transfer",
          "group leave",
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
