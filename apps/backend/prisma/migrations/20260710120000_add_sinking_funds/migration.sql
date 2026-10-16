-- Sinking funds: monthly accruals for irregular expenses, drained by expenses
-- classified under the linked spending category
CREATE TABLE "sinking_funds" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyAmount" DOUBLE PRECISION NOT NULL,
    "startPeriodKey" TEXT NOT NULL,
    "spendingCategoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sinking_funds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sinking_funds_userId_name_key" ON "sinking_funds"("userId", "name");
CREATE INDEX "sinking_funds_userId_idx" ON "sinking_funds"("userId");
CREATE INDEX "sinking_funds_spendingCategoryId_idx" ON "sinking_funds"("spendingCategoryId");

ALTER TABLE "sinking_funds" ADD CONSTRAINT "sinking_funds_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sinking_funds" ADD CONSTRAINT "sinking_funds_spendingCategoryId_fkey" FOREIGN KEY ("spendingCategoryId") REFERENCES "spending_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
