-- CreateEnum
CREATE TYPE "TreatmentKind" AS ENUM ('MEDICATION', 'SUPPLEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "IntakeStatus" AS ENUM ('TAKEN', 'SKIPPED', 'LATE');

-- CreateTable
CREATE TABLE "treatment_definitions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "TreatmentKind" NOT NULL DEFAULT 'MEDICATION',
    "detail" TEXT,
    "form" TEXT,
    "dose" TEXT,
    "slots" TEXT[],
    "notes" TEXT,
    "startedOn" DATE,
    "position" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatment_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_intakes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "treatmentId" TEXT,
    "treatmentKey" TEXT NOT NULL,
    "treatmentName" TEXT NOT NULL,
    "doseLabel" TEXT,
    "slot" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "IntakeStatus" NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatment_intakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_in_scales" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lowLabel" TEXT NOT NULL DEFAULT '',
    "highLabel" TEXT NOT NULL DEFAULT '',
    "levelLabels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxValue" INTEGER NOT NULL DEFAULT 10,
    "isPositive" BOOLEAN NOT NULL DEFAULT false,
    "isCore" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "check_in_scales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_in_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "valuesJson" JSONB NOT NULL DEFAULT '[]',
    "note" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "check_in_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "treatment_definitions_userId_position_idx" ON "treatment_definitions"("userId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "treatment_definitions_userId_key_key" ON "treatment_definitions"("userId", "key");

-- CreateIndex
CREATE INDEX "treatment_intakes_userId_date_idx" ON "treatment_intakes"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "treatment_intakes_userId_date_treatmentKey_slot_key" ON "treatment_intakes"("userId", "date", "treatmentKey", "slot");

-- CreateIndex
CREATE INDEX "check_in_scales_userId_position_idx" ON "check_in_scales"("userId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "check_in_scales_userId_key_key" ON "check_in_scales"("userId", "key");

-- CreateIndex
CREATE INDEX "check_in_entries_userId_date_idx" ON "check_in_entries"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "check_in_entries_userId_date_key" ON "check_in_entries"("userId", "date");

-- AddForeignKey
ALTER TABLE "treatment_definitions" ADD CONSTRAINT "treatment_definitions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_intakes" ADD CONSTRAINT "treatment_intakes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_intakes" ADD CONSTRAINT "treatment_intakes_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "treatment_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_in_scales" ADD CONSTRAINT "check_in_scales_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_in_entries" ADD CONSTRAINT "check_in_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
