-- CreateEnum
CREATE TYPE "RatingLinkedForm" AS ENUM ('NONE', 'MOOD');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "ratingsSeededAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "rating_definitions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxValue" INTEGER NOT NULL DEFAULT 10,
    "linkedForm" "RatingLinkedForm" NOT NULL DEFAULT 'NONE',
    "position" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rating_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ratingId" TEXT,
    "ratingKey" TEXT NOT NULL,
    "ratingName" TEXT NOT NULL,
    "value" INTEGER,
    "maxValue" INTEGER NOT NULL DEFAULT 10,
    "note" TEXT,
    "quickLogId" TEXT,
    "date" DATE NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rating_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rating_definitions_userId_position_idx" ON "rating_definitions"("userId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "rating_definitions_userId_key_key" ON "rating_definitions"("userId", "key");

-- CreateIndex
CREATE INDEX "rating_entries_userId_date_idx" ON "rating_entries"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "rating_entries_quickLogId_key" ON "rating_entries"("quickLogId");

-- CreateIndex
CREATE UNIQUE INDEX "rating_entries_userId_date_ratingKey_key" ON "rating_entries"("userId", "date", "ratingKey");

-- AddForeignKey
ALTER TABLE "rating_definitions" ADD CONSTRAINT "rating_definitions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_entries" ADD CONSTRAINT "rating_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_entries" ADD CONSTRAINT "rating_entries_ratingId_fkey" FOREIGN KEY ("ratingId") REFERENCES "rating_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_entries" ADD CONSTRAINT "rating_entries_quickLogId_fkey" FOREIGN KEY ("quickLogId") REFERENCES "quick_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
