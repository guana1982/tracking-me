-- Ordering is now the user's own: a drag rewrites the list and priority and
-- due date survive only as an action that recomputes it. Positions had been
-- handed out per kind and per day, so every group restarted at zero and the
-- merged list came out interleaved at random. This lays them out once, in one
-- sequence per user, in exactly the order the page shows today - so nobody
-- opens the app to a list that shuffled itself overnight.
WITH ordered AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "userId"
      ORDER BY
        CASE WHEN "status" = 'DONE' THEN 1 ELSE 0 END,
        CASE "priority"
          WHEN 'URGENT' THEN 0
          WHEN 'HIGH' THEN 1
          WHEN 'MEDIUM' THEN 2
          ELSE 3
        END,
        COALESCE("dueDate", DATE '9999-12-31'),
        "createdAt"
    ) - 1 AS "pos"
  FROM "activities"
)
UPDATE "activities" AS a
SET "position" = o."pos"
FROM ordered AS o
WHERE a."id" = o."id";
