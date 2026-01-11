-- Restore UPDATE policies that were accidentally removed
-- The leaderboard policies only cover SELECT, but we still need UPDATE/DELETE policies

-- Note: We removed SELECT policies because "leaderboard" policies with USING(true) cover all reads
-- But UPDATE/DELETE policies are still needed!

-- Check and recreate if missing (these should already exist, but just in case)

-- WORKOUTS: Users can update own workouts (for locking, notes, etc.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'workouts'
    AND policyname = 'Users can update own workouts'
  ) THEN
    CREATE POLICY "Users can update own workouts"
    ON public.workouts FOR UPDATE
    USING ((SELECT auth.uid()) = user_id);
  END IF;
END $$;
