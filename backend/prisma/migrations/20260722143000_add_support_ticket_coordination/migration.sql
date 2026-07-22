-- CreateEnum
CREATE TYPE "SupportTicketActivityAction" AS ENUM ('created', 'assigned', 'unassigned', 'transferred', 'status_changed', 'priority_changed', 'note_updated');

-- AlterTable
ALTER TABLE "support_tickets"
ADD COLUMN "assignedAdminId" UUID,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "support_ticket_activities" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "actorId" UUID,
    "action" "SupportTicketActivityAction" NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_tickets_assignedAdminId_status_idx" ON "support_tickets"("assignedAdminId", "status");

-- CreateIndex
CREATE INDEX "support_ticket_activities_ticketId_createdAt_idx" ON "support_ticket_activities"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "support_ticket_activities_actorId_idx" ON "support_ticket_activities"("actorId");

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_activities" ADD CONSTRAINT "support_ticket_activities_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_activities" ADD CONSTRAINT "support_ticket_activities_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
