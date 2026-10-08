-- CreateEnum
CREATE TYPE "ActivityKind" AS ENUM ('TASK', 'DEADLINE');

-- CreateEnum
CREATE TYPE "ActivityScope" AS ENUM ('DAY', 'WEEK');

-- CreateEnum
CREATE TYPE "ActivityPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "activity_types" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "kind" "ActivityKind" NOT NULL,
    "position" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "typeId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "kind" "ActivityKind" NOT NULL DEFAULT 'TASK',
    "scope" "ActivityScope" NOT NULL DEFAULT 'DAY',
    "scheduledFor" DATE NOT NULL,
    "dueDate" DATE,
    "dueTime" TEXT,
    "priority" "ActivityPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "ActivityStatus" NOT NULL DEFAULT 'TODO',
    "position" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "activity_types_userId_key_key" ON "activity_types"("userId", "key");

-- CreateIndex
CREATE INDEX "activity_types_userId_kind_position_idx" ON "activity_types"("userId", "kind", "position");

-- CreateIndex
CREATE INDEX "activities_userId_scheduledFor_status_idx" ON "activities"("userId", "scheduledFor", "status");

-- CreateIndex
CREATE INDEX "activities_userId_dueDate_status_idx" ON "activities"("userId", "dueDate", "status");

-- CreateIndex
CREATE INDEX "activities_typeId_idx" ON "activities"("typeId");

-- AddForeignKey
ALTER TABLE "activity_types" ADD CONSTRAINT "activity_types_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "activity_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
