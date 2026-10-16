-- CreateTable
CREATE TABLE "fixed_expense_templates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixed_expense_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fixed_expense_templates_userId_idx" ON "fixed_expense_templates"("userId");

-- CreateIndex
CREATE INDEX "fixed_expense_templates_category_idx" ON "fixed_expense_templates"("category");

-- AddForeignKey
ALTER TABLE "fixed_expense_templates" ADD CONSTRAINT "fixed_expense_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
