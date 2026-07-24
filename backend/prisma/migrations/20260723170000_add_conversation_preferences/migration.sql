CREATE TABLE "conversation_preferences" (
    "userId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "isBookmarked" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_preferences_pkey" PRIMARY KEY ("userId", "conversationId")
);

CREATE INDEX "conversation_preferences_userId_isBookmarked_idx"
ON "conversation_preferences"("userId", "isBookmarked");

CREATE INDEX "conversation_preferences_userId_isArchived_idx"
ON "conversation_preferences"("userId", "isArchived");

CREATE INDEX "conversation_preferences_userId_isDeleted_idx"
ON "conversation_preferences"("userId", "isDeleted");

ALTER TABLE "conversation_preferences"
ADD CONSTRAINT "conversation_preferences_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversation_preferences"
ADD CONSTRAINT "conversation_preferences_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
