-- Fix workout_sets constraint to support timed exercises.
-- Timed sets use plank_seconds and keep cardio fields NULL.
-- Cardio sets must still provide both distance_km and duration_minutes.

ALTER TABLE public.workout_sets
DROP CONSTRAINT IF EXISTS workout_sets_cardio_check;

ALTER TABLE public.workout_sets
ADD CONSTRAINT workout_sets_cardio_check
CHECK (
  (
    distance_km IS NOT NULL
    AND duration_minutes IS NOT NULL
    AND plank_seconds IS NULL
  )
  OR
  (
    distance_km IS NULL
    AND duration_minutes IS NULL
  )
);
