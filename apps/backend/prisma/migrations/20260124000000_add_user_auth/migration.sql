-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "googleId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "picture" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_googleId_idx" ON "users"("googleId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- Create a default migration user for existing data
INSERT INTO "users" ("id", "googleId", "email", "name", "createdAt", "updatedAt")
VALUES ('default-migration-user', 'MIGRATION_PLACEHOLDER', 'migration@system.local', 'Dati Migrati', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Add userId column to month_periods (nullable first)
ALTER TABLE "month_periods" ADD COLUMN "userId" TEXT;

-- Assign existing month_periods to migration user
UPDATE "month_periods" SET "userId" = 'default-migration-user' WHERE "userId" IS NULL;

-- Make userId required
ALTER TABLE "month_periods" ALTER COLUMN "userId" SET NOT NULL;

-- Drop old unique indexes (they were created with CREATE UNIQUE INDEX, not as constraints)
DROP INDEX IF EXISTS "month_periods_periodKey_key";
DROP INDEX IF EXISTS "month_periods_year_month_key";

-- Add foreign key constraint
ALTER TABLE "month_periods" ADD CONSTRAINT "month_periods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create new unique constraints (per user)
CREATE UNIQUE INDEX "month_periods_userId_periodKey_key" ON "month_periods"("userId", "periodKey");
CREATE UNIQUE INDEX "month_periods_userId_year_month_key" ON "month_periods"("userId", "year", "month");

-- Create index on userId
CREATE INDEX "month_periods_userId_idx" ON "month_periods"("userId");
