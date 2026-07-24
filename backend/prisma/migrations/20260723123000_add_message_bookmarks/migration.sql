CREATE TABLE "message_bookmarks" (
    "userId" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_bookmarks_pkey" PRIMARY KEY ("userId", "messageId")
);

CREATE INDEX "message_bookmarks_userId_createdAt_idx"
ON "message_bookmarks"("userId", "createdAt");

CREATE INDEX "message_bookmarks_messageId_idx"
ON "message_bookmarks"("messageId");

ALTER TABLE "message_bookmarks"
ADD CONSTRAINT "message_bookmarks_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "message_bookmarks"
ADD CONSTRAINT "message_bookmarks_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "messages"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
