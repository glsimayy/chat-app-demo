import { PublicUser } from "../users/user.types";
import { CatchUpWindow } from "./catch-up-window.enum";
import { MessageRecord } from "./conversation.types";
import { MessageType } from "./message-type.enum";

const MAX_ANALYZED_MESSAGES = 1_000;
const MAX_ACTIVE_PARTICIPANTS = 5;
const MAX_TOPICS = 6;
const MAX_KEY_MOMENTS = 6;
const RECENT_MESSAGE_LINK_LIMIT = 100;

const STOP_WORDS = new Set(
  [
    "acaba",
    "ama",
    "ancak",
    "artık",
    "aslında",
    "bana",
    "bazı",
    "belki",
    "ben",
    "bence",
    "bile",
    "bir",
    "biraz",
    "biz",
    "böyle",
    "bu",
    "bunu",
    "burada",
    "çok",
    "çünkü",
    "daha",
    "de",
    "da",
    "diye",
    "doğru",
    "en",
    "evet",
    "gibi",
    "göre",
    "hala",
    "hangi",
    "hem",
    "hep",
    "her",
    "için",
    "ile",
    "ise",
    "işte",
    "kadar",
    "ki",
    "mi",
    "mı",
    "mu",
    "mü",
    "nasıl",
    "ne",
    "neden",
    "olarak",
    "oldu",
    "olan",
    "olabilir",
    "sadece",
    "sonra",
    "şey",
    "şimdi",
    "tamam",
    "var",
    "ve",
    "veya",
    "ya",
    "yani",
    "yok",
    "zaten",
    "about",
    "after",
    "again",
    "also",
    "and",
    "are",
    "because",
    "been",
    "before",
    "but",
    "can",
    "could",
    "did",
    "does",
    "for",
    "from",
    "have",
    "here",
    "into",
    "just",
    "like",
    "more",
    "not",
    "now",
    "only",
    "our",
    "should",
    "some",
    "than",
    "that",
    "the",
    "then",
    "there",
    "they",
    "this",
    "was",
    "were",
    "what",
    "when",
    "where",
    "which",
    "will",
    "with",
    "would",
    "you",
    "your",
    "http",
    "https",
    "www",
    "com",
    "ello",
  ].map((word) => word.toLocaleLowerCase("tr-TR")),
);

const DECISION_MARKERS = [
  "karar",
  "kararlaştır",
  "anlaştık",
  "onaylandı",
  "onayladık",
  "kabul edildi",
  "decided",
  "decision",
  "agreed",
  "approved",
];

const ACTION_MARKERS = [
  "yapılacak",
  "yapmamız",
  "yapmalıyız",
  "yapalım",
  "gerekiyor",
  "gerekli",
  "lazım",
  "son tarih",
  "teslim",
  "görev",
  "sorumlu",
  "todo",
  "action item",
  "deadline",
  "must",
  "need to",
  "assigned",
];

export interface ConversationCatchUpParticipant {
  userId: string;
  username: string;
  messageCount: number;
}

export interface ConversationCatchUpTopic {
  label: string;
  count: number;
}

export type ConversationCatchUpMomentKind = "decision" | "action" | "highlight";

export interface ConversationCatchUpMoment {
  messageId: string;
  kind: ConversationCatchUpMomentKind;
  senderId: string;
  senderUsername: string;
  preview: string;
  createdAt: Date;
  replyCount: number;
  attachmentCount: number;
}

export interface ConversationCatchUp {
  conversationId: string;
  window: CatchUpWindow;
  startAt: Date;
  endAt: Date;
  generatedAt: Date;
  summary: string;
  messageCount: number;
  participantCount: number;
  replyCount: number;
  attachmentCount: number;
  systemEventCount: number;
  analyzedMessageCount: number;
  truncated: boolean;
  activeParticipants: ConversationCatchUpParticipant[];
  topics: ConversationCatchUpTopic[];
  keyMoments: ConversationCatchUpMoment[];
}

interface BuildConversationCatchUpOptions {
  conversationId: string;
  window: CatchUpWindow;
  startAt: Date;
  endAt: Date;
  messages: MessageRecord[];
  resolveUser: (userId: string) => PublicUser | undefined;
}

const normalizeText = (value: string) =>
  value.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();

const containsMarker = (content: string, markers: string[]) => {
  const normalized = normalizeText(content);
  return markers.some((marker) => normalized.includes(marker));
};

const classifyMoment = (
  message: MessageRecord,
): ConversationCatchUpMomentKind => {
  if (containsMarker(message.content, DECISION_MARKERS)) {
    return "decision";
  }

  if (containsMarker(message.content, ACTION_MARKERS)) {
    return "action";
  }

  return "highlight";
};

const getMessagePreview = (message: MessageRecord) => {
  const content = message.content.trim();

  if (content) {
    return content.length > 180 ? `${content.slice(0, 177)}...` : content;
  }

  const attachment = message.attachments?.[0];
  return attachment ? `Attachment: ${attachment.fileName}` : "Attachment";
};

const formatWindow = (window: CatchUpWindow) => {
  switch (window) {
    case CatchUpWindow.TwentyFourHours:
      return "the last 24 hours";
    case CatchUpWindow.SevenDays:
      return "the last 7 days";
    default:
      return "the last 2 hours";
  }
};

const buildSummary = (
  window: CatchUpWindow,
  messageCount: number,
  participantCount: number,
  topics: ConversationCatchUpTopic[],
  notableCount: number,
  attachmentCount: number,
) => {
  if (messageCount === 0) {
    return `No messages were posted in ${formatWindow(window)}.`;
  }

  const participantCopy =
    participantCount === 1
      ? "1 participant"
      : `${participantCount} participants`;
  const topicCopy =
    topics.length > 0
      ? ` Main topics: ${topics.map((topic) => topic.label).join(", ")}.`
      : "";
  const notableCopy =
    notableCount > 0
      ? ` ${notableCount} decision or action message${notableCount === 1 ? "" : "s"} stood out.`
      : "";
  const attachmentCopy =
    attachmentCount > 0
      ? ` ${attachmentCount} attachment${attachmentCount === 1 ? " was" : "s were"} shared.`
      : "";

  return `${messageCount} message${messageCount === 1 ? " was" : "s were"} posted by ${participantCopy} in ${formatWindow(window)}.${topicCopy}${notableCopy}${attachmentCopy}`;
};

export const buildConversationCatchUp = ({
  conversationId,
  window,
  startAt,
  endAt,
  messages,
  resolveUser,
}: BuildConversationCatchUpOptions): ConversationCatchUp => {
  const visibleMessages = messages.filter(
    (message) =>
      !message.deletedAt &&
      message.createdAt >= startAt &&
      message.createdAt <= endAt,
  );
  const userMessages = visibleMessages.filter(
    (message) =>
      message.messageType === MessageType.User && Boolean(message.senderId),
  );
  const analyzedMessages = userMessages.slice(-MAX_ANALYZED_MESSAGES);
  const recentMessageIds = new Set(
    messages
      .filter((message) => !message.deletedAt)
      .slice(-RECENT_MESSAGE_LINK_LIMIT)
      .map((message) => message.id),
  );
  const usernameTokens = new Set<string>();
  const participantCounts = new Map<string, ConversationCatchUpParticipant>();

  for (const message of userMessages) {
    const senderId = message.senderId as string;
    const username = resolveUser(senderId)?.username ?? "Unknown participant";
    const current = participantCounts.get(senderId);
    participantCounts.set(senderId, {
      userId: senderId,
      username,
      messageCount: (current?.messageCount ?? 0) + 1,
    });

    for (const token of normalizeText(username).match(/[\p{L}\p{N}]+/gu) ??
      []) {
      usernameTokens.add(token);
    }
  }

  const tokenCounts = new Map<string, number>();
  for (const message of analyzedMessages) {
    const tokens =
      normalizeText(message.content).match(/[\p{L}\p{N}]+/gu) ?? [];
    for (const token of tokens) {
      if (
        token.length < 3 ||
        /^\d+$/.test(token) ||
        STOP_WORDS.has(token) ||
        usernameTokens.has(token)
      ) {
        continue;
      }
      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
    }
  }

  const minimumTopicCount = analyzedMessages.length >= 6 ? 2 : 1;
  const topics =
    analyzedMessages.length < 2
      ? []
      : Array.from(tokenCounts.entries())
          .filter(([, count]) => count >= minimumTopicCount)
          .sort(
            ([leftWord, leftCount], [rightWord, rightCount]) =>
              rightCount - leftCount || leftWord.localeCompare(rightWord, "tr"),
          )
          .slice(0, MAX_TOPICS)
          .map(([label, count]) => ({ label, count }));

  const replyCounts = new Map<string, number>();
  for (const message of userMessages) {
    if (message.replyToMessageId) {
      replyCounts.set(
        message.replyToMessageId,
        (replyCounts.get(message.replyToMessageId) ?? 0) + 1,
      );
    }
  }

  const scoredMoments = analyzedMessages
    .filter((message) => recentMessageIds.has(message.id))
    .map((message) => {
      const kind = classifyMoment(message);
      const messageReplyCount = replyCounts.get(message.id) ?? 0;
      const attachmentCount = message.attachments?.length ?? 0;
      const score =
        (kind === "decision" ? 8 : kind === "action" ? 6 : 0) +
        Math.min(messageReplyCount * 2, 6) +
        (attachmentCount > 0 ? 2 : 0) +
        (message.isForwarded ? 1 : 0) +
        (message.content.length >= 80 ? 1 : 0);

      return {
        message,
        kind,
        messageReplyCount,
        attachmentCount,
        score,
      };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.message.createdAt.getTime() - left.message.createdAt.getTime(),
    )
    .slice(0, MAX_KEY_MOMENTS);

  if (scoredMoments.length === 0 && analyzedMessages.length > 0) {
    const fallback = analyzedMessages
      .filter((message) => recentMessageIds.has(message.id))
      .slice(-Math.min(3, MAX_KEY_MOMENTS))
      .reverse();

    scoredMoments.push(
      ...fallback.map((message) => ({
        message,
        kind: "highlight" as const,
        messageReplyCount: replyCounts.get(message.id) ?? 0,
        attachmentCount: message.attachments?.length ?? 0,
        score: 1,
      })),
    );
  }

  const keyMoments = scoredMoments.map(
    ({ message, kind, messageReplyCount, attachmentCount }) => {
      const senderId = message.senderId as string;
      return {
        messageId: message.id,
        kind,
        senderId,
        senderUsername:
          resolveUser(senderId)?.username ?? "Unknown participant",
        preview: getMessagePreview(message),
        createdAt: message.createdAt,
        replyCount: messageReplyCount,
        attachmentCount,
      };
    },
  );
  const activeParticipants = Array.from(participantCounts.values())
    .sort(
      (left, right) =>
        right.messageCount - left.messageCount ||
        left.username.localeCompare(right.username, "tr"),
    )
    .slice(0, MAX_ACTIVE_PARTICIPANTS);
  const replyCount = userMessages.filter(
    (message) => message.replyToMessageId,
  ).length;
  const attachmentCount = userMessages.reduce(
    (total, message) => total + (message.attachments?.length ?? 0),
    0,
  );
  const notableCount = analyzedMessages.filter(
    (message) => classifyMoment(message) !== "highlight",
  ).length;

  return {
    conversationId,
    window,
    startAt,
    endAt,
    generatedAt: new Date(),
    summary: buildSummary(
      window,
      userMessages.length,
      participantCounts.size,
      topics,
      notableCount,
      attachmentCount,
    ),
    messageCount: userMessages.length,
    participantCount: participantCounts.size,
    replyCount,
    attachmentCount,
    systemEventCount: visibleMessages.filter(
      (message) => message.messageType === MessageType.System,
    ).length,
    analyzedMessageCount: analyzedMessages.length,
    truncated: userMessages.length > analyzedMessages.length,
    activeParticipants,
    topics,
    keyMoments,
  };
};
