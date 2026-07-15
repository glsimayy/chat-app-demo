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
});
