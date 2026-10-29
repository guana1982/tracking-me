-- CreateEnum
CREATE TYPE "HabitMeasure" AS ENUM ('DONE', 'COUNT', 'DURATION');

-- CreateEnum
CREATE TYPE "HabitStatus" AS ENUM ('DONE', 'SKIPPED');

-- CreateTable
CREATE TABLE "habit_definitions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "measure" "HabitMeasure" NOT NULL DEFAULT 'DONE',
    "unit" TEXT NOT NULL DEFAULT '',
    "target" INTEGER,
    "moment" TEXT,
    "daysOfWeek" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "track" "DayTrack" NOT NULL DEFAULT 'NONE',
    "position" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "habit_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habit_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "habitId" TEXT,
    "habitKey" TEXT NOT NULL,
    "habitName" TEXT NOT NULL,
    "measure" "HabitMeasure" NOT NULL DEFAULT 'DONE',
    "unit" TEXT NOT NULL DEFAULT '',
    "date" DATE NOT NULL,
    "status" "HabitStatus" NOT NULL,
    "value" INTEGER,
    "note" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "habit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "habit_definitions_userId_position_idx" ON "habit_definitions"("userId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "habit_definitions_userId_key_key" ON "habit_definitions"("userId", "key");

-- CreateIndex
CREATE INDEX "habit_entries_userId_date_idx" ON "habit_entries"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "habit_entries_userId_date_habitKey_key" ON "habit_entries"("userId", "date", "habitKey");

-- AddForeignKey
ALTER TABLE "habit_definitions" ADD CONSTRAINT "habit_definitions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_entries" ADD CONSTRAINT "habit_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_entries" ADD CONSTRAINT "habit_entries_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "habit_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
