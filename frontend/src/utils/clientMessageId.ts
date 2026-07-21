type CryptoProvider = Pick<Crypto, "getRandomValues"> &
  Partial<Pick<Crypto, "randomUUID">>;

const formatUuid = (bytes: Uint8Array) => {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, value =>
    value.toString(16).padStart(2, "0"),
  ).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
};

export const createClientMessageId = (
  cryptoProvider: CryptoProvider | null | undefined = globalThis.crypto,
) => {
  if (typeof cryptoProvider?.randomUUID === "function") {
    return cryptoProvider.randomUUID();
  }

  if (typeof cryptoProvider?.getRandomValues === "function") {
    return formatUuid(cryptoProvider.getRandomValues(new Uint8Array(16)));
  }

  const bytes = Uint8Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256),
  );

  return formatUuid(bytes);
};
