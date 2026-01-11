-- Recreate UPDATE policy for workouts
DROP POLICY IF EXISTS "Users can update own workouts" ON public.workouts;

CREATE POLICY "Users can update own workouts"
ON public.workouts FOR UPDATE
USING ((SELECT auth.uid()) = user_id);
