import { createClientMessageId } from "./clientMessageId";

describe("createClientMessageId", () => {
  it("uses randomUUID when it is available", () => {
    const randomUUID = jest.fn(() => "00000000-0000-4000-8000-000000000001");
    const cryptoProvider = {
      randomUUID,
      getRandomValues: jest.fn(),
    } as unknown as Crypto;

    expect(createClientMessageId(cryptoProvider)).toBe(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it("creates an RFC 4122 v4 id without secure-context randomUUID", () => {
    const cryptoProvider = {
      getRandomValues: (values: Uint8Array) => {
        values.forEach((_, index) => {
          values[index] = index;
        });
        return values;
      },
    } as unknown as Crypto;

    expect(createClientMessageId(cryptoProvider)).toBe(
      "00010203-0405-4607-8809-0a0b0c0d0e0f",
    );
  });

  it("still returns an id when Web Crypto is unavailable", () => {
    expect(createClientMessageId(null)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
