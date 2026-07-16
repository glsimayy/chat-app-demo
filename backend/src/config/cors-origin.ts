export type CorsOrigin = true | string[];

export function parseCorsOrigin(value: string): CorsOrigin {
  if (value.trim() === "*") {
    return true;
  }

  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error("CORS_ORIGIN must contain at least one origin");
  }

  for (const origin of origins) {
    let parsed: URL;

    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`CORS_ORIGIN contains an invalid origin: ${origin}`);
    }

    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.origin !== origin
    ) {
      throw new Error(`CORS_ORIGIN contains an invalid origin: ${origin}`);
    }
  }

  return [...new Set(origins)];
}
