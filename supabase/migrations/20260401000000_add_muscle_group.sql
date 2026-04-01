-- Add muscle_group column to exercises table
ALTER TABLE public.exercises
ADD COLUMN IF NOT EXISTS muscle_group TEXT NOT NULL DEFAULT 'other';

-- Add check constraint for valid muscle groups
ALTER TABLE public.exercises
ADD CONSTRAINT exercises_muscle_group_check
CHECK (muscle_group IN ('chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'core', 'cardio', 'fullbody', 'other'));

-- Populate preset exercises with correct muscle groups
UPDATE public.exercises SET muscle_group = 'chest' WHERE name = 'Отжимания' AND is_preset = true;
UPDATE public.exercises SET muscle_group = 'chest' WHERE name = 'Штанга лёжа' AND is_preset = true;
UPDATE public.exercises SET muscle_group = 'chest' WHERE name = 'Отжимания на брусьях' AND is_preset = true;

UPDATE public.exercises SET muscle_group = 'back' WHERE name = 'Подтягивания' AND is_preset = true;
UPDATE public.exercises SET muscle_group = 'back' WHERE name = 'Тяга на себя' AND is_preset = true;
UPDATE public.exercises SET muscle_group = 'back' WHERE name = 'Тяга верхнего блока' AND is_preset = true;

UPDATE public.exercises SET muscle_group = 'shoulders' WHERE name = 'Гантели Плечи' AND is_preset = true;
UPDATE public.exercises SET muscle_group = 'shoulders' WHERE name = 'Разведение гантелей в стороны' AND is_preset = true;

UPDATE public.exercises SET muscle_group = 'biceps' WHERE name = 'Гантели Бицепс' AND is_preset = true;

UPDATE public.exercises SET muscle_group = 'triceps' WHERE name = 'Жим вниз на блоке' AND is_preset = true;

UPDATE public.exercises SET muscle_group = 'legs' WHERE name = 'Приседания' AND is_preset = true;
UPDATE public.exercises SET muscle_group = 'legs' WHERE name = 'Жим Ногами' AND is_preset = true;
UPDATE public.exercises SET muscle_group = 'legs' WHERE name = 'Разгибание ног в тренажёре' AND is_preset = true;

UPDATE public.exercises SET muscle_group = 'core' WHERE name = 'Пресс' AND is_preset = true;
UPDATE public.exercises SET muscle_group = 'core' WHERE name = 'Подъём ног' AND is_preset = true;
UPDATE public.exercises SET muscle_group = 'core' WHERE name = 'Планка' AND is_preset = true;

UPDATE public.exercises SET muscle_group = 'cardio' WHERE name = 'Бег' AND is_preset = true;
