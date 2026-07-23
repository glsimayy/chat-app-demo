export const MAX_MESSAGE_ATTACHMENTS = 5;
export const MAX_MESSAGE_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export const ALLOWED_MESSAGE_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  "audio/mp4",
]);
