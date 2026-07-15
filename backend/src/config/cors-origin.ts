export type CorsOrigin = true | string[];

export function parseCorsOrigin(value: string): CorsOrigin {
  if (value.trim() === "*") {
    return true;
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
