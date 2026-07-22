-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'medium',
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'open',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_tickets_requesterId_createdAt_idx" ON "support_tickets"("requesterId", "createdAt");

-- CreateIndex
CREATE INDEX "support_tickets_status_priority_idx" ON "support_tickets"("status", "priority");

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
