-- Not having had a side effect is a non-event, not a good day.
--
-- Archiving the old side-effect scales stops new answers, but the answers
-- already written keep scoring: the day state reads every check-in value ever
-- saved. Putting those scales out of the tracks makes the past stop counting
-- too, without deleting anything.

UPDATE "check_in_scales" SET "track" = 'NONE' WHERE "isSideEffect" = true;
