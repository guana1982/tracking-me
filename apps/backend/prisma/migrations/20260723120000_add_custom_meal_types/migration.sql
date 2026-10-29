-- Meal type values become extensible strings while preserving the existing
-- BREAKFAST/LUNCH/DINNER/SNACK values already stored in meals.
ALTER TABLE "meals"
  ALTER COLUMN "mealType" TYPE TEXT USING "mealType"::text;

DROP TYPE "MealType";

CREATE TABLE "meal_type_definitions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "meal_type_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meal_type_definitions_userId_key_key"
  ON "meal_type_definitions"("userId", "key");
CREATE INDEX "meal_type_definitions_userId_position_idx"
  ON "meal_type_definitions"("userId", "position");

ALTER TABLE "meal_type_definitions"
  ADD CONSTRAINT "meal_type_definitions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
