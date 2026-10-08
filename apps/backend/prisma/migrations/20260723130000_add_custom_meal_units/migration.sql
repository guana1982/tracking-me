-- Meal item units become extensible strings while preserving all existing
-- G/ML/PIECES/PORTION/TBSP/CUP values.
ALTER TABLE "meal_items"
  ALTER COLUMN "unit" TYPE TEXT USING "unit"::text;

DROP TYPE "MealItemUnit";

CREATE TABLE "meal_unit_definitions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "meal_unit_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meal_unit_definitions_userId_key_key"
  ON "meal_unit_definitions"("userId", "key");
CREATE INDEX "meal_unit_definitions_userId_position_idx"
  ON "meal_unit_definitions"("userId", "position");

ALTER TABLE "meal_unit_definitions"
  ADD CONSTRAINT "meal_unit_definitions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
