-- AlterTable
ALTER TABLE "messages" ADD COLUMN "replyToMessageId" UUID;

-- CreateIndex
CREATE INDEX "messages_replyToMessageId_idx" ON "messages"("replyToMessageId");

-- AddForeignKey
ALTER TABLE "messages"
ADD CONSTRAINT "messages_replyToMessageId_fkey"
FOREIGN KEY ("replyToMessageId") REFERENCES "messages"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
