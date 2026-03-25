-- Create workout sharing table and base RLS policies
-- This migration must run before 20260113300000_optimize_all_rls_policies.sql

CREATE TABLE IF NOT EXISTS public.workout_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_active_share_per_workout UNIQUE (workout_id, is_active)
);

CREATE INDEX IF NOT EXISTS idx_workout_shares_token
  ON public.workout_shares (share_token)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_workout_shares_user
  ON public.workout_shares (user_id);

ALTER TABLE public.workout_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active shares"
ON public.workout_shares FOR SELECT
USING (is_active = true);

CREATE POLICY "Users can view their own shares"
ON public.workout_shares FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create shares for their workouts"
ON public.workout_shares FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.workouts
    WHERE workouts.id = workout_shares.workout_id
    AND workouts.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own shares"
ON public.workout_shares FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shares"
ON public.workout_shares FOR DELETE
USING (auth.uid() = user_id);
