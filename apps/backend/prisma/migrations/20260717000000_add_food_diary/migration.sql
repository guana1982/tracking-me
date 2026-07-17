-- Food Diary module: meals, meal items, in-db photos and raw quick logs.
-- Isolated domain: only shares the users table with the budget module.

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateEnum
CREATE TYPE "MealItemUnit" AS ENUM ('G', 'ML', 'PIECES', 'PORTION', 'TBSP', 'CUP');

-- CreateEnum
CREATE TYPE "QuickLogCategory" AS ENUM ('WORKOUT', 'SLEEP', 'SUPPLEMENT', 'FEELING');

-- CreateEnum
CREATE TYPE "QuickLogValence" AS ENUM ('POSITIVE', 'NEGATIVE', 'NEUTRAL');

-- CreateTable
CREATE TABLE "meals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mealType" "MealType" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_items" (
    "id" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "foodName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" "MealItemUnit",
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "meal_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_photos" (
    "id" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quick_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text" TEXT NOT NULL,
    "mealId" TEXT,
    "derivedCategory" "QuickLogCategory",
    "derivedValence" "QuickLogValence",
    "categoryManual" BOOLEAN NOT NULL DEFAULT false,
    "valenceManual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quick_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meals_userId_idx" ON "meals"("userId");

-- CreateIndex
CREATE INDEX "meals_userId_date_idx" ON "meals"("userId", "date");

-- CreateIndex
CREATE INDEX "meal_items_mealId_idx" ON "meal_items"("mealId");

-- CreateIndex
CREATE UNIQUE INDEX "meal_photos_mealId_key" ON "meal_photos"("mealId");

-- CreateIndex
CREATE INDEX "quick_logs_userId_idx" ON "quick_logs"("userId");

-- CreateIndex
CREATE INDEX "quick_logs_userId_loggedAt_idx" ON "quick_logs"("userId", "loggedAt");

-- CreateIndex
CREATE INDEX "quick_logs_mealId_idx" ON "quick_logs"("mealId");

-- AddForeignKey
ALTER TABLE "meals" ADD CONSTRAINT "meals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_photos" ADD CONSTRAINT "meal_photos_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quick_logs" ADD CONSTRAINT "quick_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quick_logs" ADD CONSTRAINT "quick_logs_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "meals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
