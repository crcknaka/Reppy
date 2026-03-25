-- Restore missing RLS policies removed by previous consolidation migrations
--
-- Issues addressed:
-- 1) exercises SELECT policy was dropped without a replacement
-- 2) explicit own-profile SELECT policy was dropped
-- 3) public share-token read policies for workouts/workout_sets were dropped
--
-- IMPORTANT:
-- We intentionally do NOT drop existing policies. Each policy is created only if
-- it does not already exist, so existing production setups remain unchanged.

-- ============================================================================
-- EXERCISES TABLE
-- ============================================================================
-- Allow everyone to read preset exercises (needed for public shared workout pages)
-- and allow authenticated users to read their own custom exercises.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exercises'
      AND policyname = 'Users can view preset and own exercises'
  ) THEN
    CREATE POLICY "Users can view preset and own exercises"
    ON public.exercises FOR SELECT
    TO public
    USING (
      is_preset = true
      OR ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id)
    );
  END IF;
END $$;

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
-- Restore explicit own-profile read policy (defense-in-depth and clearer intent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

-- ============================================================================
-- WORKOUTS TABLE
-- ============================================================================
-- Restore explicit own-workout read policy.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workouts'
      AND policyname = 'Users can view own workouts'
  ) THEN
    CREATE POLICY "Users can view own workouts"
    ON public.workouts FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

-- Restore anonymous/public access to workouts only when there is an active share.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workouts'
      AND policyname = 'Public read access via share token'
  ) THEN
    CREATE POLICY "Public read access via share token"
    ON public.workouts FOR SELECT
    TO public
    USING (
      EXISTS (
        SELECT 1 FROM public.workout_shares
        WHERE workout_shares.workout_id = workouts.id
          AND workout_shares.is_active = true
          AND workout_shares.expires_at > now()
      )
    );
  END IF;
END $$;

-- ============================================================================
-- WORKOUT_SETS TABLE
-- ============================================================================
-- Restore explicit own-workout-sets read policy.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workout_sets'
      AND policyname = 'Users can view own workout sets'
  ) THEN
    CREATE POLICY "Users can view own workout sets"
    ON public.workout_sets FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.workouts w
        WHERE w.id = workout_sets.workout_id
          AND w.user_id = (SELECT auth.uid())
      )
    );
  END IF;
END $$;

-- Restore anonymous/public access to workout sets only for publicly shared workouts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workout_sets'
      AND policyname = 'Public read sets via share token'
  ) THEN
    CREATE POLICY "Public read sets via share token"
    ON public.workout_sets FOR SELECT
    TO public
    USING (
      EXISTS (
        SELECT 1
        FROM public.workouts
        JOIN public.workout_shares ON workout_shares.workout_id = workouts.id
        WHERE workouts.id = workout_sets.workout_id
          AND workout_shares.is_active = true
          AND workout_shares.expires_at > now()
      )
    );
  END IF;
END $$;
