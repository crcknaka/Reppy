-- Add exercise_order column to workouts table
-- Stores ordered array of exercise_ids for user-defined exercise ordering
ALTER TABLE public.workouts
ADD COLUMN IF NOT EXISTS exercise_order JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.workouts.exercise_order
IS 'Ordered array of exercise_ids defining the display order of exercises in the workout';
8