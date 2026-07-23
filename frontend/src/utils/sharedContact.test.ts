import {
  createSharedContactMessage,
  parseSharedContactMessage,
} from "./sharedContact";

describe("shared contact messages", () => {
  it("stores only an encoded user reference", () => {
    const content = createSharedContactMessage("user/id 42");

    expect(content).toBe("ello://contact/user%2Fid%2042");
    expect(parseSharedContactMessage(content)).toBe("user/id 42");
  });

  it("ignores regular messages and malformed references", () => {
    expect(parseSharedContactMessage("hello")).toBeNull();
    expect(parseSharedContactMessage("ello://contact/")).toBeNull();
    expect(parseSharedContactMessage("ello://contact/user\nother")).toBeNull();
  });
});
