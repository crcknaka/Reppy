-- Add set completion flag for workout sets
ALTER TABLE public.workout_sets
ADD COLUMN IF NOT EXISTS is_completed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.workout_sets.is_completed
IS 'Whether the set has been marked as completed in the workout UI';
