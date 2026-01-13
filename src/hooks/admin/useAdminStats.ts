import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminStats {
  totalUsers: number;
  activeUsers7d: number;
  activeUsers30d: number;
  totalWorkouts: number;
  workoutsToday: number;
  totalExercises: number;
  avgWorkoutsPerUser: number;
  topExercises: Array<{ name: string; count: number }>;
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

      // Calculate average workouts per user
      const avgWorkoutsPerUser =
        totalUsers && totalUsers > 0
          ? Math.round(((totalWorkouts || 0) / totalUsers) * 10) / 10
          : 0;

      return {
        totalUsers: totalUsers || 0,
        activeUsers7d,
        activeUsers30d,
        totalWorkouts: totalWorkouts || 0,
        workoutsToday: workoutsToday || 0,
        totalExercises,
        avgWorkoutsPerUser,
        topExercises,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
