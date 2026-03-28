-- Fix infinite recursion in workout_shares RLS policy
-- The INSERT policy had a subquery on workouts that caused recursion when combined with SELECT policy

-- Drop the problematic INSERT policy
DROP POLICY IF EXISTS "Users can create shares for their workouts" ON public.workout_shares;

-- Recreate with simpler check (no subquery on workouts)
CREATE POLICY "Users can create shares for their workouts"
ON public.workout_shares
FOR INSERT
WITH CHECK (auth.uid() = user_id);
