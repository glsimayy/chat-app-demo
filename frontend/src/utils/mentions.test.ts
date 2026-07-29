import {
  buildMentionMembers,
  findActiveMentionQuery,
  getMentionSuggestions,
  replaceActiveMention,
  tokenizeMentions,
} from "./mentions";

const activeMembers = buildMentionMembers([
  {
    userId: "user-1",
    leftAt: null,
    user: {
      id: "user-1",
      username: "alice",
      email: "alice@example.com",
    },
  },
  {
    userId: "user-2",
    leftAt: null,
    user: {
      id: "user-2",
      username: "bob",
      email: "bob@example.com",
    },
  },
  {
    userId: "former-user",
    leftAt: "2026-07-29T10:00:00.000Z",
    user: {
      id: "former-user",
      username: "former",
      email: "former@example.com",
    },
  },
]);

describe("group mentions", () => {
  it("keeps only active participants with a known identity", () => {
    expect(activeMembers.map(member => member.userId)).toEqual([
      "user-1",
      "user-2",
    ]);
  });

  it("finds a username mention at the caret", () => {
    expect(findActiveMentionQuery("Hello @ali", 10)).toEqual({
      start: 6,
      end: 10,
      query: "ali",
    });
  });

  it("treats the second at sign in an email as part of one mention", () => {
    const text = "Ask @alice@example.c about it";

    expect(findActiveMentionQuery(text, 20)).toEqual({
      start: 4,
      end: 20,
      query: "alice@example.c",
    });
    expect(getMentionSuggestions("alice@", activeMembers)).toEqual([
      activeMembers[0],
    ]);
  });

  it("replaces the complete token with an email mention", () => {
    const text = "Ask @alice@exampl tomorrow";
    const query = findActiveMentionQuery(text, 17);

    expect(query).not.toBeNull();
    expect(replaceActiveMention(text, query!, activeMembers[0])).toEqual({
      text: "Ask @alice@example.com tomorrow",
      caretPosition: 22,
    });
  });

  it("highlights only exact aliases belonging to active members", () => {
    const segments = tokenizeMentions(
      "Hi @alice and @bob@example.com, not @former.",
      activeMembers,
    );

    expect(
      segments
        .filter(segment => segment.isMention)
        .map(segment => segment.text),
    ).toEqual(["@alice", "@bob@example.com"]);
    expect(segments.map(segment => segment.text).join("")).toBe(
      "Hi @alice and @bob@example.com, not @former.",
    );
  });
});
