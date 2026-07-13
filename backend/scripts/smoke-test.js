const { io } = require("socket.io-client");

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000/api";
const SOCKET_URL = process.env.SOCKET_URL ?? "http://localhost:3000/chat";
const BOT_WEBHOOK_SECRET =
  process.env.BOT_WEBHOOK_SECRET ?? "dev-bot-secret";

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

function waitFor(socket, eventName) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${eventName}`)),
      5000,
    );

    socket.once(eventName, (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
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

  const alpha = await register("smoke_alpha", stamp);
  const beta = await register("smoke_beta", stamp);

  const me = await request("GET", "/auth/me", undefined, {
    token: alpha.accessToken,
  });
  assert(me.id === alpha.user.id, "auth/me returned the wrong user");

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

  const page = await request(
    "GET",
    `/conversations/${directConversation.id}/messages?limit=2`,
    undefined,
    { token: alpha.accessToken },
  );
  assert(page.items.length === 2, "Message pagination did not return 2 items");
  assert(page.pageInfo.hasMore === true, "Message pagination hasMore failed");

  const alphaSocket = await connectSocket(alpha.accessToken);
  const betaSocket = await connectSocket(beta.accessToken);

  try {
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
    const sent = await emitWithAck(alphaSocket, "message:send", {
      conversationId: directConversation.id,
      content: "smoke socket message",
    });
    const newMessage = await newMessagePromise;

    assert(sent.success === true, "Socket message send ack failed");
    assert(
      newMessage.content === "smoke socket message",
      "Socket message:new payload failed",
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

  const botGroup = await request(
    "POST",
    "/bot/groups",
    {
      ownerId: alpha.user.id,
      name: "Smoke Bot Group",
      participantIds: [beta.user.id],
      externalRef: `smoke-${stamp}`,
    },
    { botSecret: BOT_WEBHOOK_SECRET },
  );
  assert(botGroup.type === "group", "Bot group create failed");

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
          "direct conversations",
          "message pagination",
          "socket message send/update/delete",
          "socket presence",
          "bot group create",
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
