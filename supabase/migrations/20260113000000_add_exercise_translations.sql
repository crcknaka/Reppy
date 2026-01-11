-- Add name_translations JSONB column to exercises table
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS name_translations JSONB DEFAULT '{}';

-- Update preset exercises with translations
UPDATE exercises SET name_translations = '{
  "en": "Push-ups",
  "es": "Flexiones",
  "pt-BR": "Flexões",
  "de": "Liegestütze",
  "fr": "Pompes"
}'::jsonb WHERE name = 'Отжимания' AND is_preset = true;

UPDATE exercises SET name_translations = '{
  "en": "Squats",
  "es": "Sentadillas",
  "pt-BR": "Agachamentos",
  "de": "Kniebeugen",
  "fr": "Squats"
}'::jsonb WHERE name = 'Приседания' AND is_preset = true;

UPDATE exercises SET name_translations = '{
  "en": "Abs",
  "es": "Abdominales",
  "pt-BR": "Abdominais",
  "de": "Bauchmuskel",
  "fr": "Abdos"
}'::jsonb WHERE name = 'Пресс' AND is_preset = true;

UPDATE exercises SET name_translations = '{
  "en": "Pull-ups",
  "es": "Dominadas",
  "pt-BR": "Barras",
  "de": "Klimmzüge",
  "fr": "Tractions"
}'::jsonb WHERE name = 'Подтягивания' AND is_preset = true;

UPDATE exercises SET name_translations = '{
  "en": "Bench Press",
  "es": "Press de banca",
  "pt-BR": "Supino",
  "de": "Bankdrücken",
  "fr": "Développé couché"
}'::jsonb WHERE name = 'Штанга лёжа' AND is_preset = true;

UPDATE exercises SET name_translations = '{
  "en": "Shoulder Press",
  "es": "Press de hombros",
  "pt-BR": "Desenvolvimento",
  "de": "Schulterdrücken",
  "fr": "Développé épaules"
}'::jsonb WHERE name = 'Гантели Плечи' AND is_preset = true;

UPDATE exercises SET name_translations = '{
  "en": "Bicep Curls",
  "es": "Curl de bíceps",
  "pt-BR": "Rosca bíceps",
  "de": "Bizepscurls",
  "fr": "Curl biceps"
}'::jsonb WHERE name = 'Гантели Бицепс' AND is_preset = true;

UPDATE exercises SET name_translations = '{
  "en": "Cable Row",
  "es": "Remo con cable",
  "pt-BR": "Remada",
  "de": "Kabelrudern",
  "fr": "Tirage câble"
}'::jsonb WHERE name = 'Тяга на себя' AND is_preset = true;

UPDATE exercises SET name_translations = '{
  "en": "Running",
  "es": "Correr",
  "pt-BR": "Corrida",
  "de": "Laufen",
  "fr": "Course"
}'::jsonb WHERE name = 'Бег' AND is_preset = true;

UPDATE exercises SET name_translations = '{
  "en": "Plank",
  "es": "Plancha",
  "pt-BR": "Prancha",
  "de": "Plank",
  "fr": "Planche"
}'::jsonb WHERE name = 'Планка' AND is_preset = true;

UPDATE exercises SET name_translations = '{
  "en": "Lat Pulldown",
  "es": "Jalón al pecho",
  "pt-BR": "Puxada alta",
  "de": "Latzug",
  "fr": "Tirage poitrine"
}'::jsonb WHERE name = 'Тяга верхнего блока' AND is_preset = true;

UPDATE exercises SET name_translations = '{
  "en": "Dips",
  "es": "Fondos",
  "pt-BR": "Paralelas",
  "de": "Dips",
  "fr": "Dips"
}'::jsonb WHERE name = 'Отжимания на брусьях' AND is_preset = true;

UPDATE exercises SET name_translations = '{
  "en": "Leg Press",
  "es": "Prensa de piernas",
  "pt-BR": "Leg press",
  "de": "Beinpresse",
  "fr": "Presse à cuisses"
}'::jsonb WHERE name = 'Жим ногами' AND is_preset = true;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_exercises_name_translations ON exercises USING GIN (name_translations);
