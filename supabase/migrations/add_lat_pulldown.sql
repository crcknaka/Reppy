-- Добавление упражнения "Тяга верхнего блока"
INSERT INTO public.exercises (name, type, is_preset, image_url)
SELECT 'Тяга верхнего блока', 'weighted'::exercise_type, true, '/exercises/lat-pulldown.jpg'
WHERE NOT EXISTS (
  SELECT 1 FROM public.exercises WHERE name = 'Тяга верхнего блока' AND is_preset = true
);
