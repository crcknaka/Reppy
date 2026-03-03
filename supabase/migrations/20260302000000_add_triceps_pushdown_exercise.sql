-- Add new preset exercise: Triceps Pushdown (weighted)

INSERT INTO public.exercises (name, type, is_preset, image_url, name_translations) VALUES
  ('Жим вниз на блоке', 'weighted', true, '/exercises/triceps-pushdown.jpg', '{
    "en": "Triceps Pushdown",
    "es": "Jalon de triceps",
    "pt-BR": "Extensao de triceps",
    "de": "Trizepsdruecken am Kabel",
    "fr": "Tirage triceps"
  }'::jsonb);
