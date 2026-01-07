# Изображения упражнений

Сохраните изображения упражнений в эту папку со следующими именами:

## Упражнения с собственным весом:
1. **pushups.jpg** - Отжимания (3-е изображение - мужчина в упоре лёжа)
2. **squats.jpg** - Приседания (6-е изображение - мужчина в приседе)
3. **abs.jpg** - Пресс (5-е изображение - мужчина делает скручивания)
4. **pullups.jpg** - Подтягивания (4-е изображение - мужчина на перекладине)

## Упражнения с весом:
5. **bench-press.jpg** - Штанга лёжа (нужно добавить отдельно)
6. **shoulder-press.jpg** - Гантели Плечи (1-е изображение - жим гантелей сидя)
7. **bicep-curl.jpg** - Гантели Бицепс (2-е изображение - сгибания на бицепс)
8. **cable-row.jpg** - Тяга на себя (8-е изображение - тяга на блоке)

## Инструкция:
1. Сохраните каждое изображение с соответствующим именем файла
2. Убедитесь, что формат файлов - .jpg
3. Рекомендуемый размер: 800x600 пикселей или больше
4. После сохранения всех изображений, примените миграцию базы данных

## Применение изменений:
```bash
cd supabase
supabase db reset
```

Или выполните в SQL Editor:
```sql
-- Добавить колонку image_url если её ещё нет
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Обновить существующие упражнения
UPDATE public.exercises SET image_url = '/exercises/pushups.jpg' WHERE name = 'Отжимания';
UPDATE public.exercises SET image_url = '/exercises/squats.jpg' WHERE name = 'Приседания';
UPDATE public.exercises SET image_url = '/exercises/abs.jpg' WHERE name = 'Пресс';
UPDATE public.exercises SET image_url = '/exercises/pullups.jpg' WHERE name = 'Подтягивания';
UPDATE public.exercises SET image_url = '/exercises/bench-press.jpg' WHERE name = 'Штанга лёжа';
UPDATE public.exercises SET image_url = '/exercises/shoulder-press.jpg' WHERE name = 'Гантели Плечи';
UPDATE public.exercises SET image_url = '/exercises/bicep-curl.jpg' WHERE name = 'Гантели Бицепс';
UPDATE public.exercises SET image_url = '/exercises/cable-row.jpg' WHERE name = 'Тяга на себя';
```

