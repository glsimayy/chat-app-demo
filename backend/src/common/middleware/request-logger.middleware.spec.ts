import {
  normalizeRequestId,
  sanitizeRequestPath,
} from "./request-logger.middleware";

describe("request log sanitization", () => {
  it("redacts sensitive query parameters and preserves safe ones", () => {
    expect(
      sanitizeRequestPath(
        "/api/messages?q=hello&access_token=jwt-value&password=secret-value&api-key=key-value",
      ),
    ).toBe(
      "/api/messages?q=hello&access_token=REDACTED&password=REDACTED&api-key=REDACTED",
    );
  });

  it("drops the query string when the URL cannot be parsed", () => {
    expect(sanitizeRequestPath("http://%?token=secret-value")).toBe("http://%");
  });

  it("accepts bounded request ids and replaces unsafe values", () => {
    expect(normalizeRequestId("request-123")).toBe("request-123");

    const generated = normalizeRequestId("token=secret-value\nforged-log");
    expect(generated).toMatch(/^[0-9a-f-]{36}$/i);
    expect(generated).not.toContain("secret-value");
  });
});
