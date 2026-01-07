-- Create enum for exercise type
CREATE TYPE public.exercise_type AS ENUM ('bodyweight', 'weighted');

-- Create exercises table (pre-set and custom exercises)
CREATE TABLE public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type exercise_type NOT NULL DEFAULT 'weighted',
  is_preset BOOLEAN NOT NULL DEFAULT false,
  image_url TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create workouts table
CREATE TABLE public.workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create workout_sets table (exercise results)
CREATE TABLE public.workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID REFERENCES public.workouts(id) ON DELETE CASCADE NOT NULL,
  exercise_id UUID REFERENCES public.exercises(id) ON DELETE CASCADE NOT NULL,
  set_number INTEGER NOT NULL DEFAULT 1,
  reps INTEGER NOT NULL,
  weight DECIMAL(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  current_weight DECIMAL(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create body_weight_history table for tracking weight changes
CREATE TABLE public.body_weight_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  weight DECIMAL(5,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_weight_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exercises
CREATE POLICY "Users can view preset and own exercises"
ON public.exercises FOR SELECT
USING (is_preset = true OR auth.uid() = user_id);

CREATE POLICY "Users can create own exercises"
ON public.exercises FOR INSERT
WITH CHECK (auth.uid() = user_id AND is_preset = false);

CREATE POLICY "Users can update own exercises"
ON public.exercises FOR UPDATE
USING (auth.uid() = user_id AND is_preset = false);

CREATE POLICY "Users can delete own exercises"
ON public.exercises FOR DELETE
USING (auth.uid() = user_id AND is_preset = false);

-- RLS Policies for workouts
CREATE POLICY "Users can view own workouts"
ON public.workouts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own workouts"
ON public.workouts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workouts"
ON public.workouts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workouts"
ON public.workouts FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for workout_sets
CREATE POLICY "Users can view own workout sets"
ON public.workout_sets FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.workouts w 
  WHERE w.id = workout_sets.workout_id AND w.user_id = auth.uid()
));

CREATE POLICY "Users can create sets for own workouts"
ON public.workout_sets FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.workouts w 
  WHERE w.id = workout_sets.workout_id AND w.user_id = auth.uid()
));

CREATE POLICY "Users can update own workout sets"
ON public.workout_sets FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.workouts w 
  WHERE w.id = workout_sets.workout_id AND w.user_id = auth.uid()
));

CREATE POLICY "Users can delete own workout sets"
ON public.workout_sets FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.workouts w 
  WHERE w.id = workout_sets.workout_id AND w.user_id = auth.uid()
));

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

-- RLS Policies for body_weight_history
CREATE POLICY "Users can view own weight history"
ON public.body_weight_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own weight records"
ON public.body_weight_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weight records"
ON public.body_weight_history FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own weight records"
ON public.body_weight_history FOR DELETE
USING (auth.uid() = user_id);

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (new.id, new.raw_user_meta_data ->> 'display_name');
  RETURN new;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for workouts updated_at
CREATE TRIGGER update_workouts_updated_at
  BEFORE UPDATE ON public.workouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert preset exercises
INSERT INTO public.exercises (name, type, is_preset, image_url) VALUES
  ('Отжимания', 'bodyweight', true, '/exercises/pushups.jpg'),
  ('Приседания', 'bodyweight', true, '/exercises/squats.jpg'),
  ('Пресс', 'bodyweight', true, '/exercises/abs.jpg'),
  ('Подтягивания', 'bodyweight', true, '/exercises/pullups.jpg'),
  ('Штанга лёжа', 'weighted', true, '/exercises/bench-press.jpg'),
  ('Гантели Плечи', 'weighted', true, '/exercises/shoulder-press.jpg'),
  ('Гантели Бицепс', 'weighted', true, '/exercises/bicep-curl.jpg'),
  ('Тяга на себя', 'weighted', true, '/exercises/cable-row.jpg');