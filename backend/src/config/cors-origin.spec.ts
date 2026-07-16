import { parseCorsOrigin } from "./cors-origin";

describe("parseCorsOrigin", () => {
  it("allows reflected origins only for the development wildcard", () => {
    expect(parseCorsOrigin("*")).toBe(true);
  });

  it("parses a comma-separated allowlist", () => {
    expect(
      parseCorsOrigin("http://localhost:5173, https://chat.example.com"),
    ).toEqual(["http://localhost:5173", "https://chat.example.com"]);
  });

  it("removes duplicate origins", () => {
    expect(
      parseCorsOrigin("https://chat.example.com,https://chat.example.com"),
    ).toEqual(["https://chat.example.com"]);
  });

  it.each([
    "chat.example.com",
    "ftp://chat.example.com",
    "https://chat.example.com/path",
  ])("rejects invalid origins", (origin) => {
    expect(() => parseCorsOrigin(origin)).toThrow(
      "CORS_ORIGIN contains an invalid origin",
    );
  });
});
