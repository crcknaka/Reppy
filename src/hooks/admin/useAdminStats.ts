import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminStats {
  totalUsers: number;
  activeUsers7d: number;
  activeUsers30d: number;
  totalWorkouts: number;
  workoutsToday: number;
  workoutsThisWeek: number;
  workoutsThisMonth: number;
  totalExercises: number;
  totalSets: number;
  avgWorkoutsPerUser: number;
  avgSetsPerWorkout: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  topExercises: Array<{ name: string; count: number }>;
  topUsers: Array<{ name: string; username: string | null; avatar: string | null; workoutCount: number }>;
}

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async (): Promise<AdminStats> => {
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      // Run all independent queries in parallel
      const [
        totalUsersResult,
        totalWorkoutsResult,
        workoutsTodayResult,
        workoutsThisWeekResult,
        workoutsThisMonthResult,
        activeUsers7dResult,
        activeUsers30dResult,
        exerciseDataResult,
        totalSetsResult,
        newUsersThisWeekResult,
        newUsersThisMonthResult,
        topExercisesResult,
        userWorkoutsResult,
      ] = await Promise.all([
        // Total users
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        // Total workouts
        supabase.from("workouts").select("*", { count: "exact", head: true }),
        // Workouts today
        supabase.from("workouts").select("*", { count: "exact", head: true }).gte("date", today),
        // Workouts this week
        supabase.from("workouts").select("*", { count: "exact", head: true }).gte("date", sevenDaysAgo),
        // Workouts this month
        supabase.from("workouts").select("*", { count: "exact", head: true }).gte("date", thirtyDaysAgo),
        // Active users 7d
        supabase.from("workouts").select("user_id").gte("date", sevenDaysAgo),
        // Active users 30d
        supabase.from("workouts").select("user_id").gte("date", thirtyDaysAgo),
        // Exercise data for unique count
        supabase.from("workout_sets").select("exercise_id"),
        // Total sets
        supabase.from("workout_sets").select("*", { count: "exact", head: true }),
        // New users this week
        supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
        // New users this month
        supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
        // Top exercises data
        supabase.from("workout_sets").select(`exercise_id, exercises ( name )`),
        // User workouts for top users
        supabase.from("workouts").select("user_id"),
      ]);

      const totalUsers = totalUsersResult.count;
      const totalWorkouts = totalWorkoutsResult.count;
      const workoutsToday = workoutsTodayResult.count;
      const workoutsThisWeek = workoutsThisWeekResult.count;
      const workoutsThisMonth = workoutsThisMonthResult.count;
      const activeUsers7d = new Set(activeUsers7dResult.data?.map((w) => w.user_id)).size;
      const activeUsers30d = new Set(activeUsers30dResult.data?.map((w) => w.user_id)).size;
      const totalExercises = new Set(exerciseDataResult.data?.map((e) => e.exercise_id)).size;
      const totalSets = totalSetsResult.count;
      const newUsersThisWeek = newUsersThisWeekResult.count;
      const newUsersThisMonth = newUsersThisMonthResult.count;

      // Process top exercises
      const exerciseCounts = new Map<string, { name: string; count: number }>();
      topExercisesResult.data?.forEach((item) => {
        const exerciseId = item.exercise_id;
        const name = (item.exercises as { name: string } | null)?.name || "Unknown";
        const existing = exerciseCounts.get(exerciseId);
        if (existing) {
          existing.count++;
        } else {
          exerciseCounts.set(exerciseId, { name, count: 1 });
        }
      });

      const topExercises = Array.from(exerciseCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Process top users
      const userWorkoutCounts = new Map<string, number>();
      userWorkoutsResult.data?.forEach((w) => {
        const existing = userWorkoutCounts.get(w.user_id) || 0;
        userWorkoutCounts.set(w.user_id, existing + 1);
      });

      const topUserIds = Array.from(userWorkoutCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([userId]) => userId);

      // This query depends on topUserIds, so it runs after Promise.all
      const { data: topUserProfiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar")
        .in("user_id", topUserIds);

      const profileMap = new Map(
        topUserProfiles?.map((p) => [p.user_id, p]) || []
      );

      const topUsers = topUserIds.map((userId) => ({
        name: profileMap.get(userId)?.display_name || "Unknown",
        username: profileMap.get(userId)?.username || null,
        avatar: profileMap.get(userId)?.avatar || null,
        workoutCount: userWorkoutCounts.get(userId) || 0,
      }));

      // Calculate averages
      const avgWorkoutsPerUser =
        totalUsers && totalUsers > 0
          ? Math.round(((totalWorkouts || 0) / totalUsers) * 10) / 10
          : 0;

      const avgSetsPerWorkout =
        totalWorkouts && totalWorkouts > 0
          ? Math.round(((totalSets || 0) / totalWorkouts) * 10) / 10
          : 0;

      return {
        totalUsers: totalUsers || 0,
        activeUsers7d,
        activeUsers30d,
        totalWorkouts: totalWorkouts || 0,
        workoutsToday: workoutsToday || 0,
        workoutsThisWeek: workoutsThisWeek || 0,
        workoutsThisMonth: workoutsThisMonth || 0,
        totalExercises,
        totalSets: totalSets || 0,
        avgWorkoutsPerUser,
        avgSetsPerWorkout,
        newUsersThisWeek: newUsersThisWeek || 0,
        newUsersThisMonth: newUsersThisMonth || 0,
        topExercises,
        topUsers,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export interface UniqueExerciseWithUsers {
  exerciseId: string;
  exerciseName: string;
  users: Array<{
    userId: string;
    displayName: string | null;
    username: string | null;
    avatar: string | null;
  }>;
}

export function useUniqueExercises() {
  return useQuery({
    queryKey: ["admin", "uniqueExercises"],
    queryFn: async (): Promise<UniqueExerciseWithUsers[]> => {
      // Get only user-created exercises (not presets)
      const { data: userExercises } = await supabase
        .from("exercises")
        .select("id, name, user_id")
        .eq("is_preset", false);

      if (!userExercises || userExercises.length === 0) return [];

      const exerciseIds = userExercises.map((e) => e.id);

      // Get workout sets for these exercises
      const { data: setsData } = await supabase
        .from("workout_sets")
        .select(`
          exercise_id,
          workouts (
            user_id
          )
        `)
        .in("exercise_id", exerciseIds);

      // Build exercise name map from userExercises
      const exerciseNameMap = new Map(userExercises.map((e) => [e.id, e.name]));
      const exerciseCreatorMap = new Map(userExercises.map((e) => [e.id, e.user_id]));

      // Group exercises with unique users who used them
      const exerciseUsers = new Map<string, { name: string; creatorId: string | null; userIds: Set<string> }>();

      // Initialize all user exercises (even if not used in any workout)
      userExercises.forEach((exercise) => {
        exerciseUsers.set(exercise.id, {
          name: exercise.name,
          creatorId: exercise.user_id,
          userIds: new Set(),
        });
      });

      // Add users who used each exercise
      setsData?.forEach((item) => {
        const exerciseId = item.exercise_id;
        const userId = (item.workouts as { user_id: string } | null)?.user_id;

        if (!userId) return;

        const existing = exerciseUsers.get(exerciseId);
        if (existing) {
          existing.userIds.add(userId);
        }
      });

      // Get all unique user IDs (including creators)
      const allUserIds = new Set<string>();
      exerciseUsers.forEach((data) => {
        if (data.creatorId) allUserIds.add(data.creatorId);
        data.userIds.forEach((id) => allUserIds.add(id));
      });

      // Fetch user profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar")
        .in("user_id", Array.from(allUserIds));

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      // Build result
      const result: UniqueExerciseWithUsers[] = [];
      exerciseUsers.forEach((data, exerciseId) => {
        result.push({
          exerciseId,
          exerciseName: data.name,
          users: Array.from(data.userIds).map((userId) => {
            const profile = profileMap.get(userId);
            return {
              userId,
              displayName: profile?.display_name || null,
              username: profile?.username || null,
              avatar: profile?.avatar || null,
            };
          }),
        });
      });

      // Sort by exercise name
      return result.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
    },
    staleTime: 1000 * 60 * 5,
  });
}
