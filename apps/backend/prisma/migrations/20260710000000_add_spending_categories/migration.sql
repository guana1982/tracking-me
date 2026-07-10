-- Spending categories: fine-grained expense classification (Spesa, Bollette, Auto, ...)
CREATE TABLE "spending_categories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spending_categories_pkey" PRIMARY KEY ("id")
);

-- Keyword rules mapping expense labels to spending categories
CREATE TABLE "category_rules" (
    "id" TEXT NOT NULL,
    "spendingCategoryId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_rules_pkey" PRIMARY KEY ("id")
);

-- Expense linkage to spending category (nullable: SAVINGS transfers stay unclassified)
ALTER TABLE "expenses" ADD COLUMN "spendingCategoryId" TEXT;
ALTER TABLE "expenses" ADD COLUMN "spendingCategoryManual" BOOLEAN NOT NULL DEFAULT false;

-- Indexes
CREATE UNIQUE INDEX "spending_categories_userId_name_key" ON "spending_categories"("userId", "name");
CREATE INDEX "spending_categories_userId_idx" ON "spending_categories"("userId");
CREATE INDEX "category_rules_spendingCategoryId_idx" ON "category_rules"("spendingCategoryId");
CREATE INDEX "expenses_spendingCategoryId_idx" ON "expenses"("spendingCategoryId");

-- Foreign keys
ALTER TABLE "spending_categories" ADD CONSTRAINT "spending_categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_spendingCategoryId_fkey" FOREIGN KEY ("spendingCategoryId") REFERENCES "spending_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_spendingCategoryId_fkey" FOREIGN KEY ("spendingCategoryId") REFERENCES "spending_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
