-- Mood becomes its own quick-log category, tracked separately from FEELING
-- (physical sensations) so the two day tracks can be read independently.
ALTER TYPE "QuickLogCategory" ADD VALUE 'MOOD';
