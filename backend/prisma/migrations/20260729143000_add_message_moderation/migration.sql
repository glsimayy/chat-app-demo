CREATE TYPE "MessageReportReason" AS ENUM (
  'harassment',
  'sexual_content',
  'violence_or_threat',
  'spam',
  'impersonation',
  'other'
);

CREATE TYPE "MessageReportStatus" AS ENUM (
  'pending',
  'resolved',
  'dismissed'
);

CREATE TYPE "ModerationResolutionAction" AS ENUM (
  'dismiss',
  'delete_message',
  'warn_user',
  'suspend_user'
);

ALTER TABLE "users"
  ADD COLUMN "moderationWarningCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "suspendedUntil" TIMESTAMP(3),
  ADD COLUMN "suspensionReason" TEXT;

CREATE TABLE "message_reports" (
  "id" UUID NOT NULL,
  "messageId" UUID NOT NULL,
  "reporterId" UUID NOT NULL,
  "reason" "MessageReportReason" NOT NULL,
  "details" TEXT,
  "status" "MessageReportStatus" NOT NULL DEFAULT 'pending',
  "resolutionAction" "ModerationResolutionAction",
  "resolutionNote" TEXT,
  "reviewedByAdminId" UUID,
  "evidenceAuditId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),

  CONSTRAINT "message_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "message_reports_messageId_reporterId_key"
  ON "message_reports"("messageId", "reporterId");

CREATE INDEX "message_reports_status_createdAt_idx"
  ON "message_reports"("status", "createdAt");

CREATE INDEX "message_reports_reason_status_idx"
  ON "message_reports"("reason", "status");

CREATE INDEX "message_reports_reviewedByAdminId_resolvedAt_idx"
  ON "message_reports"("reviewedByAdminId", "resolvedAt");

ALTER TABLE "message_reports"
  ADD CONSTRAINT "message_reports_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "messages"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "message_reports"
  ADD CONSTRAINT "message_reports_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "message_reports"
  ADD CONSTRAINT "message_reports_reviewedByAdminId_fkey"
  FOREIGN KEY ("reviewedByAdminId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
