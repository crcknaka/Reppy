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

      // Get total users
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Get total workouts
      const { count: totalWorkouts } = await supabase
        .from("workouts")
        .select("*", { count: "exact", head: true });

      // Get workouts today
      const { count: workoutsToday } = await supabase
        .from("workouts")
        .select("*", { count: "exact", head: true })
        .gte("date", today);

      // Get workouts this week
      const { count: workoutsThisWeek } = await supabase
        .from("workouts")
        .select("*", { count: "exact", head: true })
        .gte("date", sevenDaysAgo);

      // Get workouts this month
      const { count: workoutsThisMonth } = await supabase
        .from("workouts")
        .select("*", { count: "exact", head: true })
        .gte("date", thirtyDaysAgo);

      // Get active users in last 7 days (users with workouts)
      const { data: activeUsers7dData } = await supabase
        .from("workouts")
        .select("user_id")
        .gte("date", sevenDaysAgo);
      const activeUsers7d = new Set(activeUsers7dData?.map((w) => w.user_id)).size;

      // Get active users in last 30 days
      const { data: activeUsers30dData } = await supabase
        .from("workouts")
        .select("user_id")
        .gte("date", thirtyDaysAgo);
      const activeUsers30d = new Set(activeUsers30dData?.map((w) => w.user_id)).size;

      // Get total unique exercises used (from workout_sets table)
      const { data: exerciseData } = await supabase
        .from("workout_sets")
        .select("exercise_id");
      const totalExercises = new Set(exerciseData?.map((e) => e.exercise_id)).size;

      // Get total sets count
      const { count: totalSets } = await supabase
        .from("workout_sets")
        .select("*", { count: "exact", head: true });

      // Get new users this week
      const { count: newUsersThisWeek } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo);

      // Get new users this month
      const { count: newUsersThisMonth } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo);

      // Get top exercises by usage (count sets per exercise)
      const { data: topExercisesData } = await supabase
        .from("workout_sets")
        .select(`
          exercise_id,
          exercises (
            name
          )
        `);

      const exerciseCounts = new Map<string, { name: string; count: number }>();
      topExercisesData?.forEach((item) => {
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

      // Get top users by workout count
      const { data: userWorkoutsData } = await supabase
        .from("workouts")
        .select("user_id");

      const userWorkoutCounts = new Map<string, number>();
      userWorkoutsData?.forEach((w) => {
        const existing = userWorkoutCounts.get(w.user_id) || 0;
        userWorkoutCounts.set(w.user_id, existing + 1);
      });

      const topUserIds = Array.from(userWorkoutCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([userId]) => userId);

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

      // Calculate average workouts per user
      const avgWorkoutsPerUser =
        totalUsers && totalUsers > 0
          ? Math.round(((totalWorkouts || 0) / totalUsers) * 10) / 10
          : 0;

      // Calculate average sets per workout
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
      // Get all workout sets with exercise info and workout user
      const { data: setsData } = await supabase
        .from("workout_sets")
        .select(`
          exercise_id,
          exercises (
            name
          ),
          workouts (
            user_id
          )
        `);

      if (!setsData) return [];

      // Group exercises with unique users who did them
      const exerciseUsers = new Map<string, { name: string; userIds: Set<string> }>();

      setsData.forEach((item) => {
        const exerciseId = item.exercise_id;
        const exerciseName = (item.exercises as { name: string } | null)?.name || "Unknown";
        const userId = (item.workouts as { user_id: string } | null)?.user_id;

        if (!userId) return;

        const existing = exerciseUsers.get(exerciseId);
        if (existing) {
          existing.userIds.add(userId);
        } else {
          exerciseUsers.set(exerciseId, { name: exerciseName, userIds: new Set([userId]) });
        }
      });

      // Get all unique user IDs
      const allUserIds = new Set<string>();
      exerciseUsers.forEach((data) => {
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
