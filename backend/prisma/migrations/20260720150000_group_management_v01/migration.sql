ALTER TYPE "ConversationType" ADD VALUE 'management';
ALTER TYPE "ParticipantRole" ADD VALUE 'manager';

CREATE TYPE "ConversationStatus" AS ENUM ('active', 'closed', 'archived');

ALTER TABLE "conversations"
ADD COLUMN "description" TEXT,
ADD COLUMN "isBotManaged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sourceName" TEXT,
ADD COLUMN "memberCanSendMessages" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "membersCanLeave" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "status" "ConversationStatus" NOT NULL DEFAULT 'active',
ADD COLUMN "parentConversationId" UUID;

UPDATE "conversations"
SET "memberCanSendMessages" = true
WHERE "type" = 'group' AND "externalRef" IS NULL;

UPDATE "conversations"
SET "isBotManaged" = true,
    "membersCanLeave" = false
WHERE "type" = 'group' AND "externalRef" IS NOT NULL;

CREATE UNIQUE INDEX "conversations_parentConversationId_key"
ON "conversations"("parentConversationId");

CREATE INDEX "conversations_status_idx" ON "conversations"("status");

ALTER TABLE "conversations"
ADD CONSTRAINT "conversations_parentConversationId_fkey"
FOREIGN KEY ("parentConversationId") REFERENCES "conversations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
