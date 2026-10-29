-- Moves the side effects already installed as check-in scales over to the
-- rating catalogue, keeping their name and the treatments they came from.
--
-- Past answers are deliberately NOT converted: in the checklist model an
-- answer can say "assente", and an absence has no moment to become. The old
-- entries stay readable where they were written.

INSERT INTO "rating_definitions" (
  "id", "userId", "key", "name", "kind", "maxValue", "track",
  "sourceTreatmentKeys", "linkedForm", "position", "isActive", "isDefault",
  "createdAt", "updatedAt"
)
SELECT
  'r' || s."id",
  s."userId",
  'r' || s."key",
  s."name",
  'SIDE_EFFECT'::"RatingKind",
  3,                                   -- lieve / moderato / forte
  'BODY'::"DayTrack",
  COALESCE(s."sourceTreatmentKeys", ARRAY[]::TEXT[]),
  'NONE'::"RatingLinkedForm",
  1000 + s."position",
  s."isActive",
  false,
  NOW(),
  NOW()
FROM "check_in_scales" s
WHERE s."isSideEffect" = true
  AND NOT EXISTS (
    SELECT 1 FROM "rating_definitions" r
    WHERE r."userId" = s."userId" AND LOWER(r."name") = LOWER(s."name")
  );

-- Archived rather than deleted: the answers already given keep their scale
UPDATE "check_in_scales" SET "isActive" = false WHERE "isSideEffect" = true;
