-- The rating row is an input, not a display of state: the same characteristic
-- can be voted again later in the day, so a vote is no longer unique per day.

-- DropIndex
DROP INDEX IF EXISTS "rating_entries_userId_date_ratingKey_key";

-- CreateIndex
CREATE INDEX "rating_entries_userId_ratingKey_idx" ON "rating_entries"("userId", "ratingKey");
