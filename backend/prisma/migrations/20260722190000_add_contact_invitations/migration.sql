CREATE TYPE "ContactInvitationStatus" AS ENUM ('pending', 'accepted', 'declined');

CREATE TABLE "contact_invitations" (
    "id" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "message" TEXT,
    "status" "ContactInvitationStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "contact_invitations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_invitations_recipientId_status_createdAt_idx"
ON "contact_invitations"("recipientId", "status", "createdAt");

CREATE INDEX "contact_invitations_senderId_status_createdAt_idx"
ON "contact_invitations"("senderId", "status", "createdAt");

ALTER TABLE "contact_invitations"
ADD CONSTRAINT "contact_invitations_senderId_fkey"
FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_invitations"
ADD CONSTRAINT "contact_invitations_recipientId_fkey"
FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
