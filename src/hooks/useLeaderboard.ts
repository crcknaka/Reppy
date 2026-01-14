import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, startOfDay } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useFriends } from "@/hooks/useFriends";

export interface LeaderboardEntry {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar: string | null;
  current_weight: number | null;
  height: number | null;
  exercise_name: string;
  max_weight: number;
  max_reps: number;
  total_reps: number;
  max_distance: number;
  total_distance: number;
  max_plank_seconds: number;
  total_plank_seconds: number;
}

interface WorkoutSet {
  weight: number | null;
  reps: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  plank_seconds: number | null;
  workout: {
    user_id: string;
    date: string;
  };
  exercise: {
    name: string;
  };
}

export function useLeaderboard(
  exerciseName: string,
  timeFilter: "all" | "month" | "today" = "all",
  friendsOnly: boolean = false,
  friendIds: string[] = []
) {
  const { user, effectiveUserId } = useAuth();

  return useQuery({
    queryKey: ["leaderboard", exerciseName, timeFilter, friendsOnly, friendIds],
    queryFn: async () => {
      // Return empty when offline - leaderboard requires network
      if (!navigator.onLine) return [];

      // Build date filter
      let dateFilter = "";
      if (timeFilter === "month") {
        const monthStart = startOfMonth(new Date()).toISOString().split("T")[0];
        dateFilter = `date >= '${monthStart}'`;
      }

      // Query to get top 10 users by max weight/reps/distance for a specific exercise
      const { data: workoutSets, error } = await supabase
        .from("workout_sets")
        .select(
          `
          weight,
          reps,
          distance_km,
          duration_minutes,
          plank_seconds,
          workout:workouts!inner(
            user_id,
            date
          ),
          exercise:exercises!inner(
            name
          )
        `
        )
        .eq("exercise.name", exerciseName);

      if (error) throw error;

      // Filter by date if needed
      let filteredSets: WorkoutSet[] = (workoutSets as WorkoutSet[]) || [];
      if (timeFilter === "month") {
        const monthStart = startOfMonth(new Date());
        filteredSets = filteredSets.filter((set) => {
          const workoutDate = new Date(set.workout.date);
          return workoutDate >= monthStart;
        });
      } else if (timeFilter === "today") {
        const todayStart = startOfDay(new Date());
        filteredSets = filteredSets.filter((set) => {
          const workoutDate = new Date(set.workout.date);
          return workoutDate >= todayStart;
        });
      }

      // Filter by friends if friendsOnly is enabled
      if (friendsOnly && effectiveUserId) {
        const allowedUserIds = new Set([effectiveUserId, ...friendIds]);
        filteredSets = filteredSets.filter((set) =>
          allowedUserIds.has(set.workout.user_id)
        );
      }

      // Group by user and calculate max weight, total reps, max distance, total distance, plank seconds
      const userStats = new Map<string, {
        maxWeight: number;
        totalReps: number;
        maxReps: number;
        maxDistance: number;
        totalDistance: number;
        maxPlankSeconds: number;
        totalPlankSeconds: number;
      }>();

      filteredSets.forEach((set) => {
        const userId = set.workout.user_id;
        const weight = set.weight || 0;
        const reps = set.reps || 0;
        const distance = set.distance_km || 0;
        const plankSeconds = set.plank_seconds || 0;

        if (!userStats.has(userId)) {
          userStats.set(userId, {
            maxWeight: weight,
            totalReps: reps,
            maxReps: reps,
            maxDistance: distance,
            totalDistance: distance,
            maxPlankSeconds: plankSeconds,
            totalPlankSeconds: plankSeconds
          });
        } else {
          const stats = userStats.get(userId)!;
          stats.maxWeight = Math.max(stats.maxWeight, weight);
          stats.maxReps = Math.max(stats.maxReps, reps);
          stats.totalReps += reps;
          stats.maxDistance = Math.max(stats.maxDistance, distance);
          stats.totalDistance += distance;
          stats.maxPlankSeconds = Math.max(stats.maxPlankSeconds, plankSeconds);
          stats.totalPlankSeconds += plankSeconds;
          userStats.set(userId, stats);
        }
      });

      // Get unique user IDs
      const userIds = Array.from(userStats.keys()).slice(0, 10);

      if (userIds.length === 0) {
        return [];
      }

      // Fetch user profiles
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar, current_weight, height")
        .in("user_id", userIds);

      if (profileError) throw profileError;

      // Combine data
      const leaderboard: LeaderboardEntry[] = profiles
        .map((profile) => {
          const stats = userStats.get(profile.user_id);
          return {
            user_id: profile.user_id,
            display_name: profile.display_name,
            username: profile.username,
            avatar: profile.avatar,
            current_weight: profile.current_weight,
            height: profile.height,
            exercise_name: exerciseName,
            max_weight: stats?.maxWeight || 0,
            max_reps: stats?.maxReps || 0,
            total_reps: stats?.totalReps || 0,
            max_distance: stats?.maxDistance || 0,
            total_distance: stats?.totalDistance || 0,
            max_plank_seconds: stats?.maxPlankSeconds || 0,
            total_plank_seconds: stats?.totalPlankSeconds || 0,
          };
        })
        // Sort by max distance (for cardio), max plank seconds (for timed), max weight (for weighted), or max reps (for bodyweight)
        .sort((a, b) => {
          // If there's plank data, prioritize and sort by plank seconds
          if (a.max_plank_seconds > 0 || b.max_plank_seconds > 0) {
            return b.max_plank_seconds - a.max_plank_seconds;
          }
          // If there's distance data, prioritize and sort by distance
          if (a.max_distance > 0 || b.max_distance > 0) {
            return b.max_distance - a.max_distance;
          }
          // If both have weight, sort by weight
          if (a.max_weight > 0 && b.max_weight > 0) {
            return b.max_weight - a.max_weight;
          }
          // If neither has weight, sort by max reps
          if (a.max_weight === 0 && b.max_weight === 0) {
            return b.max_reps - a.max_reps;
          }
          // Prioritize entries with weight over those without
          return b.max_weight - a.max_weight;
        })
        .slice(0, 10);

      return leaderboard;
    },
    // Enable query only when exercise name is provided
    enabled: !!exerciseName,
  });
}
