-- Allow all authenticated users to view other users' profiles for leaderboard
CREATE POLICY "Users can view all profiles for leaderboard"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Allow all authenticated users to view workout sets for leaderboard calculations
CREATE POLICY "Users can view all workout sets for leaderboard"
ON public.workout_sets FOR SELECT
TO authenticated
USING (true);

-- Allow all authenticated users to view all workouts for leaderboard calculations
CREATE POLICY "Users can view all workouts for leaderboard"
ON public.workouts FOR SELECT
TO authenticated
USING (true);
