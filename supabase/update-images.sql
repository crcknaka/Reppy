-- Быстрое обновление: добавить изображения к упражнениям

-- Добавить колонку image_url если её ещё нет
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Обновить упражнения с изображениями
UPDATE public.exercises SET image_url = '/exercises/pushups.jpg' WHERE name = 'Отжимания' AND is_preset = true;
UPDATE public.exercises SET image_url = '/exercises/squats.jpg' WHERE name = 'Приседания' AND is_preset = true;
UPDATE public.exercises SET image_url = '/exercises/abs.jpg' WHERE name = 'Пресс' AND is_preset = true;
UPDATE public.exercises SET image_url = '/exercises/pullups.jpg' WHERE name = 'Подтягивания' AND is_preset = true;
UPDATE public.exercises SET image_url = '/exercises/bench-press.jpg' WHERE name = 'Штанга лёжа' AND is_preset = true;
UPDATE public.exercises SET image_url = '/exercises/shoulder-press.jpg' WHERE name = 'Гантели Плечи' AND is_preset = true;
UPDATE public.exercises SET image_url = '/exercises/bicep-curl.jpg' WHERE name = 'Гантели Бицепс' AND is_preset = true;
UPDATE public.exercises SET image_url = '/exercises/cable-row.jpg' WHERE name = 'Тяга на себя' AND is_preset = true;

-- Проверить результат
SELECT name, image_url, is_preset FROM public.exercises WHERE is_preset = true ORDER BY name;

