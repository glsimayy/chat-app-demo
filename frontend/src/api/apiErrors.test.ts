import { normalizeApiError } from "./apiErrors";

describe("normalizeApiError", () => {
  it("returns an actionable message when the backend is unreachable", () => {
    expect(normalizeApiError({ message: "Network Error" })).toEqual({
      message: "Server unavailable. Check your connection and try again.",
    });
  });

  it("does not expose backend details for server failures", () => {
    expect(
      normalizeApiError({
        response: {
          status: 500,
          data: { message: "database password leaked in stack" },
        },
      }),
    ).toEqual({ message: "Server error. Please try again shortly." });
  });

  it("normalizes permission and rate limit responses", () => {
    expect(normalizeApiError({ response: { status: 403 } }).message).toMatch(
      /permission/i,
    );
    expect(
      normalizeApiError({
        response: { status: 429, headers: { "retry-after": "12" } },
      }),
    ).toEqual({
      message: "Too many requests. Please wait and try again.",
      retryAfterSeconds: 12,
    });
  });
});
