-- Step 1: Add 'cardio' to exercise_type enum
-- This must be done first and committed before using the new value
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'exercise_type' AND e.enumlabel = 'cardio') THEN
    ALTER TYPE public.exercise_type ADD VALUE 'cardio';
  END IF;
END $$;

-- Step 2: Add new columns to workout_sets for cardio tracking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workout_sets' AND column_name = 'distance_km') THEN
    ALTER TABLE public.workout_sets
      ADD COLUMN distance_km DECIMAL(6,2) NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workout_sets' AND column_name = 'duration_minutes') THEN
    ALTER TABLE public.workout_sets
      ADD COLUMN duration_minutes INTEGER NULL;
  END IF;
END $$;

-- Step 3: Make reps nullable (not needed for cardio exercises)
DO $$
BEGIN
  ALTER TABLE public.workout_sets
    ALTER COLUMN reps DROP NOT NULL;
EXCEPTION
  WHEN OTHERS THEN
    -- Column is already nullable
    NULL;
END $$;

-- Step 4: Drop existing constraint if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workout_sets_cardio_check') THEN
    ALTER TABLE public.workout_sets DROP CONSTRAINT workout_sets_cardio_check;
  END IF;
END $$;

-- Step 5: Add check constraint to ensure data integrity
-- For cardio: distance_km and duration_minutes must be set, reps and weight must be null
-- For traditional exercises: reps must be set, distance_km and duration_minutes must be null
ALTER TABLE public.workout_sets
  ADD CONSTRAINT workout_sets_cardio_check
  CHECK (
    (distance_km IS NOT NULL AND duration_minutes IS NOT NULL AND reps IS NULL AND weight IS NULL)
    OR
    (reps IS NOT NULL AND distance_km IS NULL AND duration_minutes IS NULL)
  );

-- Step 6: Add preset running exercise (only if it doesn't exist)
-- Using a simpler check that doesn't reference the enum value
INSERT INTO public.exercises (name, type, is_preset, image_url)
SELECT 'Бег', 'cardio'::exercise_type, true, '/exercises/run.jpg'
WHERE NOT EXISTS (
  SELECT 1 FROM public.exercises WHERE name = 'Бег' AND is_preset = true
);

-- Step 7: Add comments for documentation
COMMENT ON COLUMN public.workout_sets.distance_km IS 'Distance in kilometers for cardio exercises (NULL for other types)';
COMMENT ON COLUMN public.workout_sets.duration_minutes IS 'Duration in minutes for cardio exercises (NULL for other types)';
