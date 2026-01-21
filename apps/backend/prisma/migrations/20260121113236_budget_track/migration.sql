-- CreateEnum
CREATE TYPE "Category" AS ENUM ('NEEDS', 'WANTS', 'SAVINGS');

-- CreateTable
CREATE TABLE "month_periods" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "periodKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "month_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_rules" (
    "id" TEXT NOT NULL,
    "monthPeriodId" TEXT NOT NULL,
    "needsPct" DOUBLE PRECISION NOT NULL DEFAULT 65,
    "wantsPct" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "savingsPct" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "cutoffDay" INTEGER NOT NULL DEFAULT 26,
    "autoReallocateNeedsRemainder" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incomes" (
    "id" TEXT NOT NULL,
    "monthPeriodId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "monthPeriodId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" "Category" NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reallocations" (
    "id" TEXT NOT NULL,
    "monthPeriodId" TEXT NOT NULL,
    "fromCategory" "Category" NOT NULL,
    "toCategory" "Category" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reallocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "month_periods_periodKey_key" ON "month_periods"("periodKey");

-- CreateIndex
CREATE INDEX "month_periods_periodKey_idx" ON "month_periods"("periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "month_periods_year_month_key" ON "month_periods"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "budget_rules_monthPeriodId_key" ON "budget_rules"("monthPeriodId");

-- CreateIndex
CREATE INDEX "incomes_monthPeriodId_idx" ON "incomes"("monthPeriodId");

-- CreateIndex
CREATE INDEX "expenses_monthPeriodId_idx" ON "expenses"("monthPeriodId");

-- CreateIndex
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- CreateIndex
CREATE INDEX "reallocations_monthPeriodId_idx" ON "reallocations"("monthPeriodId");

-- AddForeignKey
ALTER TABLE "budget_rules" ADD CONSTRAINT "budget_rules_monthPeriodId_fkey" FOREIGN KEY ("monthPeriodId") REFERENCES "month_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_monthPeriodId_fkey" FOREIGN KEY ("monthPeriodId") REFERENCES "month_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_monthPeriodId_fkey" FOREIGN KEY ("monthPeriodId") REFERENCES "month_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reallocations" ADD CONSTRAINT "reallocations_monthPeriodId_fkey" FOREIGN KEY ("monthPeriodId") REFERENCES "month_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
