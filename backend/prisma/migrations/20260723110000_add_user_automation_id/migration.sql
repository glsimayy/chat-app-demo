ALTER TABLE "users"
ADD COLUMN "automationId" INTEGER;

CREATE UNIQUE INDEX "users_automationId_key"
ON "users"("automationId");
