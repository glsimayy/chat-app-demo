CREATE TYPE "AdminMessageAccessReason" AS ENUM (
  'support_request',
  'abuse_investigation',
  'security_incident',
  'system_test',
  'other'
);

CREATE TABLE "admin_message_access_audits" (
  "id" UUID NOT NULL,
  "adminId" UUID NOT NULL,
  "messageId" UUID NOT NULL,
  "reason" "AdminMessageAccessReason" NOT NULL,
  "justification" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_message_access_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_message_access_audits_adminId_createdAt_idx"
  ON "admin_message_access_audits"("adminId", "createdAt");

CREATE INDEX "admin_message_access_audits_messageId_createdAt_idx"
  ON "admin_message_access_audits"("messageId", "createdAt");

CREATE INDEX "admin_message_access_audits_reason_idx"
  ON "admin_message_access_audits"("reason");

ALTER TABLE "admin_message_access_audits"
  ADD CONSTRAINT "admin_message_access_audits_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "admin_message_access_audits"
  ADD CONSTRAINT "admin_message_access_audits_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "messages"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
