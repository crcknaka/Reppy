import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EmptyWorkout {
  id: string;
  date: string;
  user_id: string;
  display_name: string | null;
  avatar: string | null;
}

interface InactiveUser {
  user_id: string;
  display_name: string | null;
  last_workout_date: string | null;
}

// Get count and list of empty workouts (no exercises)
export function useEmptyWorkouts() {
  return useQuery({
    queryKey: ["admin", "emptyWorkouts"],
    queryFn: async (): Promise<EmptyWorkout[]> => {
      // Get all workouts
      const { data: workouts } = await supabase
        .from("workouts")
        .select("id, date, user_id")
        .order("date", { ascending: false });

      if (!workouts || workouts.length === 0) return [];

      // Get ALL workout IDs that have sets (paginate to avoid 1000 row limit)
      // Note: Data is stored in workout_sets table, not workout_exercises
      const workoutsWithSets = new Set<string>();
      let offset = 0;
      const pageSize = 1000;

      while (true) {
        const { data: setsData } = await supabase
          .from("workout_sets")
          .select("workout_id")
          .range(offset, offset + pageSize - 1);

        if (!setsData || setsData.length === 0) break;

        setsData.forEach((s) => {
          if (s.workout_id) workoutsWithSets.add(s.workout_id);
        });

        if (setsData.length < pageSize) break;
        offset += pageSize;
      }

      // Get empty workouts (workouts without any sets)
      const emptyWorkouts = workouts.filter((w) => !workoutsWithSets.has(w.id));

      if (emptyWorkouts.length === 0) return [];

      // Get user profiles for empty workouts
      const userIds = [...new Set(emptyWorkouts.map((w) => w.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar")
        .in("user_id", userIds);

      const profileMap = new Map(
        profiles?.map((p) => [p.user_id, p]) || []
      );

      // Combine workout data with profile info
      return emptyWorkouts.map((w) => ({
        id: w.id,
        date: w.date,
        user_id: w.user_id,
        display_name: profileMap.get(w.user_id)?.display_name || null,
        avatar: profileMap.get(w.user_id)?.avatar || null,
      }));
    },
  });
}

// Delete empty workouts
export function useDeleteEmptyWorkouts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workoutIds: string[]): Promise<number> => {
      if (workoutIds.length === 0) return 0;

      const { error } = await supabase
        .from("workouts")
        .delete()
        .in("id", workoutIds);

      if (error) throw error;
      return workoutIds.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
    },
  });
}

// Get inactive users (no workouts in X days)
export function useInactiveUsers(days: number = 30) {
  return useQuery({
    queryKey: ["admin", "inactiveUsers", days],
    queryFn: async (): Promise<InactiveUser[]> => {
      const cutoffDate = new Date(
        Date.now() - days * 24 * 60 * 60 * 1000
      ).toISOString();

      // Get all profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name");

      if (!profiles) return [];

      // Get last workout date for each user
      const { data: workouts } = await supabase
        .from("workouts")
        .select("user_id, date")
        .order("date", { ascending: false });

      const lastWorkoutMap = new Map<string, string>();
      workouts?.forEach((w) => {
        if (!lastWorkoutMap.has(w.user_id)) {
          lastWorkoutMap.set(w.user_id, w.date);
        }
      });

      // Filter to inactive users
      return profiles
        .map((p) => ({
          user_id: p.user_id,
          display_name: p.display_name,
          last_workout_date: lastWorkoutMap.get(p.user_id) || null,
        }))
        .filter((u) => {
          if (!u.last_workout_date) return true; // Never had a workout
          return u.last_workout_date < cutoffDate;
        });
    },
  });
}

// Get orphaned workout sets (sets without valid workout)
export function useOrphanedExercises() {
  return useQuery({
    queryKey: ["admin", "orphanedExercises"],
    queryFn: async (): Promise<number> => {
      // Get all workout IDs
      const { data: workouts } = await supabase
        .from("workouts")
        .select("id");

      const validWorkoutIds = new Set(workouts?.map((w) => w.id) || []);

      // Get all workout sets (paginate to avoid 1000 row limit)
      const orphanedSets: string[] = [];
      let offset = 0;
      const pageSize = 1000;

      while (true) {
        const { data: sets } = await supabase
          .from("workout_sets")
          .select("id, workout_id")
          .range(offset, offset + pageSize - 1);

        if (!sets || sets.length === 0) break;

        sets.forEach((s) => {
          if (!validWorkoutIds.has(s.workout_id)) {
            orphanedSets.push(s.id);
          }
        });

        if (sets.length < pageSize) break;
        offset += pageSize;
      }

      return orphanedSets.length;
    },
  });
}

// Delete orphaned workout sets
export function useDeleteOrphanedExercises() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<number> => {
      // Get all workout IDs
      const { data: workouts } = await supabase
        .from("workouts")
        .select("id");

      const validWorkoutIds = new Set(workouts?.map((w) => w.id) || []);

      // Get all workout sets (paginate to avoid 1000 row limit)
      const orphanedIds: string[] = [];
      let offset = 0;
      const pageSize = 1000;

      while (true) {
        const { data: sets } = await supabase
          .from("workout_sets")
          .select("id, workout_id")
          .range(offset, offset + pageSize - 1);

        if (!sets || sets.length === 0) break;

        sets.forEach((s) => {
          if (!validWorkoutIds.has(s.workout_id)) {
            orphanedIds.push(s.id);
          }
        });

        if (sets.length < pageSize) break;
        offset += pageSize;
      }

      if (orphanedIds.length === 0) return 0;

      // Delete in batches to avoid issues with large deletions
      const batchSize = 100;
      for (let i = 0; i < orphanedIds.length; i += batchSize) {
        const batch = orphanedIds.slice(i, i + batchSize);
        const { error } = await supabase
          .from("workout_sets")
          .delete()
          .in("id", batch);

        if (error) throw error;
      }

      return orphanedIds.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}
