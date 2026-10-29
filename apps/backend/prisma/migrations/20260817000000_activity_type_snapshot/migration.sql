-- Keep the category label on the activity itself.
-- The type is still referenced, but the FK is SetNull: without a copy of the
-- name, deleting a type silently strips the category from every activity it
-- ever tagged.
ALTER TABLE "activities" ADD COLUMN "typeName" TEXT;
ALTER TABLE "activities" ADD COLUMN "typeColor" TEXT;

UPDATE "activities" AS a
SET "typeName" = t."name",
    "typeColor" = t."color"
FROM "activity_types" AS t
WHERE a."typeId" = t."id";
