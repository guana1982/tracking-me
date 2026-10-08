-- CreateEnum
CREATE TYPE "RatingKind" AS ENUM ('SCALE', 'EVENT');

-- CreateEnum
CREATE TYPE "MilestoneKind" AS ENUM ('EXAM', 'APPOINTMENT', 'OTHER');

-- AlterTable
ALTER TABLE "rating_definitions" ADD COLUMN "kind" "RatingKind" NOT NULL DEFAULT 'SCALE';

-- AlterTable
ALTER TABLE "rating_entries" ADD COLUMN "trigger" TEXT,
                             ADD COLUMN "kind" "RatingKind" NOT NULL DEFAULT 'SCALE';

-- AlterTable
ALTER TABLE "check_in_scales" ADD COLUMN "isSideEffect" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "titration_steps" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "treatmentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dose" TEXT NOT NULL,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "titration_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "MilestoneKind" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "items" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "advisories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weight_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weight_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "titration_steps_userId_date_idx" ON "titration_steps"("userId", "date");

-- CreateIndex
CREATE INDEX "titration_steps_treatmentId_idx" ON "titration_steps"("treatmentId");

-- CreateIndex
CREATE INDEX "milestones_userId_date_idx" ON "milestones"("userId", "date");

-- CreateIndex
CREATE INDEX "weight_entries_userId_date_idx" ON "weight_entries"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "weight_entries_userId_date_key" ON "weight_entries"("userId", "date");

-- AddForeignKey
ALTER TABLE "titration_steps" ADD CONSTRAINT "titration_steps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "titration_steps" ADD CONSTRAINT "titration_steps_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "treatment_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weight_entries" ADD CONSTRAINT "weight_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
