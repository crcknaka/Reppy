-- Add missing plank_seconds column for timed exercises (e.g., Plank)
ALTER TABLE public.workout_sets
ADD COLUMN IF NOT EXISTS plank_seconds integer;

COMMENT ON COLUMN public.workout_sets.plank_seconds
IS 'Duration in seconds for timed exercises (e.g., plank)';
