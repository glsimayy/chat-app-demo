import {
  clearMessageDraft,
  readMessageDraft,
  writeMessageDraft,
} from "./messageDrafts";

describe("message drafts", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores drafts independently by scope", () => {
    writeMessageDraft("user-1:conversation-1", "first draft");
    writeMessageDraft("user-1:conversation-2", "second draft");

    expect(readMessageDraft("user-1:conversation-1")).toBe("first draft");
    expect(readMessageDraft("user-1:conversation-2")).toBe("second draft");
  });

  it("removes a draft after it is cleared", () => {
    writeMessageDraft("user-1:conversation-1", "send me");
    clearMessageDraft("user-1:conversation-1");

    expect(readMessageDraft("user-1:conversation-1")).toBe("");
  });

  it("ignores an empty scope", () => {
    writeMessageDraft("", "not stored");

    expect(readMessageDraft("")).toBe("");
    expect(window.localStorage.length).toBe(0);
  });
});
