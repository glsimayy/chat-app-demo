require("dotenv").config({ quiet: true });

const { io } = require("socket.io-client");

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000/api";
const SOCKET_URL = process.env.SOCKET_URL ?? "http://localhost:3000/chat";
const DEV_RESET_SECRET =
  process.env.DEV_RESET_SECRET ?? "change-me-for-dev-reset";
const CLIENT_COUNT = Number(process.env.LOAD_CLIENTS ?? 5);
const MESSAGES_PER_CLIENT = Number(process.env.LOAD_MESSAGES_PER_CLIENT ?? 10);
const MAX_P95_MS = Number(process.env.LOAD_MAX_P95_MS ?? 2000);
const MIN_THROUGHPUT_PER_SECOND = Number(
  process.env.LOAD_MIN_THROUGHPUT_PER_SECOND ?? 1,
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(method, path, body, token) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(path === "/dev/reset" ? { "x-dev-secret": DEV_RESET_SECRET } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json();

  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${JSON.stringify(json)}`);
  }

  return json.data;
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(SOCKET_URL, {
      auth: { token },
      forceNew: true,
      reconnection: false,
      transports: ["websocket"],
    });
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Socket connection timed out"));
    }, 5000);

    socket.once("connect", () => {
      clearTimeout(timeout);
      resolve(socket);
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function emitWithAck(socket, eventName, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(5000).emit(eventName, payload, (error, response) => {
      if (error) {
        reject(error);
        return;
      }

      if (!response?.success) {
        reject(new Error(`${eventName} failed: ${JSON.stringify(response)}`));
        return;
      }

      resolve(response.data);
    });
  });
}

function percentile(values, percentage) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((percentage / 100) * sorted.length) - 1,
  );

  return sorted[Math.max(0, index)];
}

async function main() {
  assert(
    Number.isInteger(CLIENT_COUNT) && CLIENT_COUNT > 0,
    "LOAD_CLIENTS must be a positive integer",
  );
  assert(
    Number.isInteger(MESSAGES_PER_CLIENT) && MESSAGES_PER_CLIENT > 0,
    "LOAD_MESSAGES_PER_CLIENT must be a positive integer",
  );
  assert(MAX_P95_MS > 0, "LOAD_MAX_P95_MS must be positive");
  assert(
    MIN_THROUGHPUT_PER_SECOND > 0,
    "LOAD_MIN_THROUGHPUT_PER_SECOND must be positive",
  );

  const sockets = [];
  const senderSockets = [];

  try {
    await request("POST", "/dev/reset");
    const suffix = Date.now();
    const sender = await request("POST", "/auth/register", {
      username: `load_sender_${suffix}`,
      email: `load.sender.${suffix}@test.local`,
      password: "Password123!",
    });
    const recipient = await request("POST", "/auth/register", {
      username: `load_recipient_${suffix}`,
      email: `load.recipient.${suffix}@test.local`,
      password: "Password123!",
    });
    const conversation = await request(
      "POST",
      "/conversations/direct",
      { participantId: recipient.user.id },
      sender.accessToken,
    );
    const totalMessages = CLIENT_COUNT * MESSAGES_PER_CLIENT;
    assert(
      totalMessages <= 100,
      "This load check supports at most 100 messages per run",
    );

    const receivedMessageIds = new Set();
    let duplicateEvents = 0;
    let resolveAllMessages;
    const allMessagesReceived = new Promise((resolve) => {
      resolveAllMessages = resolve;
    });
    const recipientSocket = await connect(recipient.accessToken);
    sockets.push(recipientSocket);
    recipientSocket.on("message:new", (message) => {
      if (message?.conversationId !== conversation.id) {
        return;
      }

      if (receivedMessageIds.has(message.id)) {
        duplicateEvents += 1;
      } else {
        receivedMessageIds.add(message.id);
      }

      if (receivedMessageIds.size === totalMessages) {
        resolveAllMessages();
      }
    });
    await emitWithAck(recipientSocket, "conversation:sync", {
      conversationIds: [conversation.id],
    });

    for (let index = 0; index < CLIENT_COUNT; index += 1) {
      const socket = await connect(sender.accessToken);
      sockets.push(socket);
      senderSockets.push(socket);
      await emitWithAck(socket, "conversation:sync", {
        conversationIds: [conversation.id],
      });
    }

    const latencies = [];
    const startedAt = performance.now();

    await Promise.all(
      senderSockets.map(async (socket, clientIndex) => {
        for (
          let messageIndex = 0;
          messageIndex < MESSAGES_PER_CLIENT;
          messageIndex += 1
        ) {
          const messageStartedAt = performance.now();
          const clientMessageId = crypto.randomUUID();
          const message = await emitWithAck(socket, "message:send", {
            conversationId: conversation.id,
            content: `load-${clientIndex}-${messageIndex}`,
            clientMessageId,
          });

          assert(
            message.clientMessageId === clientMessageId,
            "Server returned the wrong clientMessageId",
          );
          latencies.push(performance.now() - messageStartedAt);
        }
      }),
    );

    const durationMs = performance.now() - startedAt;
    await Promise.race([
      allMessagesReceived,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Timed out waiting for realtime messages")),
          10_000,
        ),
      ),
    ]);
    const history = await request(
      "GET",
      `/conversations/${conversation.id}/messages?limit=100`,
      undefined,
      sender.accessToken,
    );

    assert(
      history.items.length === totalMessages,
      `Expected ${totalMessages} messages, received ${history.items.length}`,
    );
    assert(
      receivedMessageIds.size === totalMessages,
      `Expected ${totalMessages} realtime messages, received ${receivedMessageIds.size}`,
    );
    assert(
      duplicateEvents === 0,
      `Received ${duplicateEvents} duplicate events`,
    );

    const p95 = percentile(latencies, 95);
    const throughputPerSecond = (totalMessages / durationMs) * 1000;
    assert(
      p95 <= MAX_P95_MS,
      `p95 latency ${p95.toFixed(2)}ms exceeded ${MAX_P95_MS}ms`,
    );
    assert(
      throughputPerSecond >= MIN_THROUGHPUT_PER_SECOND,
      `Throughput ${throughputPerSecond.toFixed(2)}/s was below ${MIN_THROUGHPUT_PER_SECOND}/s`,
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          clients: CLIENT_COUNT,
          messagesPerClient: MESSAGES_PER_CLIENT,
          totalMessages,
          durationMs: Number(durationMs.toFixed(2)),
          realtimeMessagesReceived: receivedMessageIds.size,
          duplicateEvents,
          throughputPerSecond: Number(throughputPerSecond.toFixed(2)),
          ackLatencyMs: {
            p50: Number(percentile(latencies, 50).toFixed(2)),
            p95: Number(p95.toFixed(2)),
            max: Number(Math.max(...latencies).toFixed(2)),
          },
          thresholds: {
            maxP95Ms: MAX_P95_MS,
            minThroughputPerSecond: MIN_THROUGHPUT_PER_SECOND,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    for (const socket of sockets) {
      socket.disconnect();
    }

    try {
      await request("POST", "/dev/reset");
    } catch (error) {
      console.error(`Load-test cleanup failed: ${error.message}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
