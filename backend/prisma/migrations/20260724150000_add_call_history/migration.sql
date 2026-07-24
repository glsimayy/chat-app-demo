CREATE TYPE "CallStatus" AS ENUM (
    'ringing',
    'active',
    'completed',
    'missed',
    'declined',
    'failed'
);

CREATE TABLE "call_records" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "callerId" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'ringing',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "endedReason" TEXT,
    "endedById" UUID,

    CONSTRAINT "call_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "call_records_callerId_startedAt_idx"
ON "call_records"("callerId", "startedAt");

CREATE INDEX "call_records_recipientId_startedAt_idx"
ON "call_records"("recipientId", "startedAt");

CREATE INDEX "call_records_conversationId_startedAt_idx"
ON "call_records"("conversationId", "startedAt");

CREATE INDEX "call_records_status_idx"
ON "call_records"("status");

ALTER TABLE "call_records"
ADD CONSTRAINT "call_records_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "conversations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "call_records"
ADD CONSTRAINT "call_records_callerId_fkey"
FOREIGN KEY ("callerId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "call_records"
ADD CONSTRAINT "call_records_recipientId_fkey"
FOREIGN KEY ("recipientId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "call_records"
ADD CONSTRAINT "call_records_endedById_fkey"
FOREIGN KEY ("endedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
