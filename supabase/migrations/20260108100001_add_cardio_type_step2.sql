-- Step 2: Add preset running exercise (only if it doesn't exist)
-- This must be in a separate migration after the enum value is committed
INSERT INTO public.exercises (name, type, is_preset, image_url)
SELECT 'Бег', 'cardio'::exercise_type, true, '/exercises/run.jpg'
WHERE NOT EXISTS (
  SELECT 1 FROM public.exercises WHERE name = 'Бег' AND is_preset = true
);
