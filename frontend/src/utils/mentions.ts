export interface MentionMember {
  userId: string;
  username: string;
  email: string;
  profileImage?: string | null;
}

export interface ActiveMentionQuery {
  start: number;
  end: number;
  query: string;
}

export interface MentionSegment {
  text: string;
  isMention: boolean;
  member?: MentionMember;
}

const MENTION_TOKEN_CHARACTER = /^[A-Za-z0-9._%+@-]$/;
const MENTION_START_CHARACTER = /^[A-Za-z0-9_@]$/;

const isMentionTokenCharacter = (value: string) =>
  MENTION_TOKEN_CHARACTER.test(value);

const isMentionStartBoundary = (value?: string) =>
  !value || !MENTION_START_CHARACTER.test(value);

export const buildMentionMembers = (
  participants: Array<any> = [],
): MentionMember[] => {
  const seenUserIds = new Set<string>();

  return participants.reduce<MentionMember[]>((members, participant) => {
    if (participant?.leftAt) {
      return members;
    }

    const user = participant?.user || participant?.userData || participant;
    const userId = String(participant?.userId || user?.id || user?.uid || "");
    const username = String(user?.username || "").trim();
    const email = String(user?.email || "").trim();

    if (!userId || (!username && !email) || seenUserIds.has(userId)) {
      return members;
    }

    seenUserIds.add(userId);
    members.push({
      userId,
      username,
      email,
      profileImage: user?.profileImage || null,
    });
    return members;
  }, []);
};

export const findActiveMentionQuery = (
  text: string,
  requestedCaretPosition: number,
): ActiveMentionQuery | null => {
  const caretPosition = Math.max(
    0,
    Math.min(requestedCaretPosition, text.length),
  );

  for (let index = caretPosition - 1; index >= 0; index -= 1) {
    const character = text[index];

    if (/\s/.test(character)) {
      break;
    }

    if (
      character === "@" &&
      isMentionStartBoundary(index > 0 ? text[index - 1] : undefined)
    ) {
      const query = text.slice(index + 1, caretPosition);

      if (
        Array.from(query).some(
          queryCharacter => !isMentionTokenCharacter(queryCharacter),
        )
      ) {
        return null;
      }

      let end = caretPosition;
      while (end < text.length && isMentionTokenCharacter(text[end])) {
        end += 1;
      }

      return { start: index, end, query };
    }
  }

  return null;
};

export const getMentionSuggestions = (
  query: string,
  members: MentionMember[],
  limit = 6,
) => {
  const normalizedQuery = query.toLocaleLowerCase();

  return members
    .filter(member => {
      const username = member.username.toLocaleLowerCase();
      const email = member.email.toLocaleLowerCase();
      return (
        (!normalizedQuery && Boolean(username || email)) ||
        username.startsWith(normalizedQuery) ||
        email.startsWith(normalizedQuery)
      );
    })
    .sort((left, right) => {
      const leftUsernameMatch = left.username
        .toLocaleLowerCase()
        .startsWith(normalizedQuery);
      const rightUsernameMatch = right.username
        .toLocaleLowerCase()
        .startsWith(normalizedQuery);

      if (leftUsernameMatch !== rightUsernameMatch) {
        return leftUsernameMatch ? -1 : 1;
      }

      return (left.username || left.email).localeCompare(
        right.username || right.email,
      );
    })
    .slice(0, limit);
};

export const getMentionLabel = (
  query: string,
  member: MentionMember,
): string => {
  if (query.includes("@") && member.email) {
    return `@${member.email}`;
  }

  return `@${member.username || member.email}`;
};

export const replaceActiveMention = (
  text: string,
  activeQuery: ActiveMentionQuery,
  member: MentionMember,
) => {
  const label = getMentionLabel(activeQuery.query, member);
  const before = text.slice(0, activeQuery.start);
  const after = text.slice(activeQuery.end);
  const needsTrailingSpace =
    !after || (!/^\s/.test(after) && !/^[.,!?;:)\]}]/.test(after));
  const insertedText = `${label}${needsTrailingSpace ? " " : ""}`;

  return {
    text: `${before}${insertedText}${after}`,
    caretPosition: before.length + insertedText.length,
  };
};

export const tokenizeMentions = (
  text: string,
  members: MentionMember[],
): MentionSegment[] => {
  const aliases = members
    .flatMap(member =>
      [member.username, member.email]
        .filter(Boolean)
        .map(value => ({ label: `@${value}`, member })),
    )
    .sort((left, right) => right.label.length - left.label.length);
  const segments: MentionSegment[] = [];
  let plainTextStart = 0;
  let index = 0;

  while (index < text.length) {
    if (
      text[index] !== "@" ||
      !isMentionStartBoundary(index > 0 ? text[index - 1] : undefined)
    ) {
      index += 1;
      continue;
    }

    let matchingAlias: (typeof aliases)[number] | undefined;
    for (const alias of aliases) {
      const candidate = text.slice(index, index + alias.label.length);
      const characterAfter = text[index + alias.label.length];
      if (
        candidate.toLocaleLowerCase() === alias.label.toLocaleLowerCase() &&
        (!characterAfter || !isMentionTokenCharacter(characterAfter))
      ) {
        matchingAlias = alias;
        break;
      }
    }

    if (!matchingAlias) {
      index += 1;
      continue;
    }

    if (plainTextStart < index) {
      segments.push({
        text: text.slice(plainTextStart, index),
        isMention: false,
      });
    }

    segments.push({
      text: text.slice(index, index + matchingAlias.label.length),
      isMention: true,
      member: matchingAlias.member,
    });
    index += matchingAlias.label.length;
    plainTextStart = index;
  }

  if (plainTextStart < text.length) {
    segments.push({ text: text.slice(plainTextStart), isMention: false });
  }

  return segments.length > 0 ? segments : [{ text, isMention: false }];
};
