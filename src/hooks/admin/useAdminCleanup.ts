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

export interface UnusedExercise {
  id: string;
  name: string;
  type: string;
  user_id: string;
  display_name: string | null;
  avatar: string | null;
  last_used_date: string | null;
  created_at: string | null;
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

      // Get the current session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      // Call the admin-cleanup edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-cleanup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "deleteEmptyWorkouts", ids: workoutIds }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete workouts");
      }

      return result.count;
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
      // Get the current session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      // Call the admin-cleanup edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-cleanup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "deleteOrphanedSets" }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete orphaned sets");
      }

      return result.count;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

// Get unused user-created exercises (not used in 30+ days)
export function useUnusedExercises(days: number = 30) {
  return useQuery({
    queryKey: ["admin", "unusedExercises", days],
    queryFn: async (): Promise<UnusedExercise[]> => {
      const cutoffDate = new Date(
        Date.now() - days * 24 * 60 * 60 * 1000
      ).toISOString().split("T")[0];

      // Get all user-created exercises (is_preset = false)
      const { data: exercises } = await supabase
        .from("exercises")
        .select("id, name, type, user_id, created_at")
        .eq("is_preset", false)
        .not("user_id", "is", null);

      if (!exercises || exercises.length === 0) return [];

      // Get last usage date for each exercise from workout_sets
      // We need to join with workouts to get the date
      const exerciseIds = exercises.map((e) => e.id);

      // Get all workout_sets for these exercises (paginate)
      const exerciseUsageMap = new Map<string, string>(); // exercise_id -> last workout date
      let offset = 0;
      const pageSize = 1000;

      while (true) {
        const { data: setsData } = await supabase
          .from("workout_sets")
          .select("exercise_id, workout_id")
          .in("exercise_id", exerciseIds)
          .range(offset, offset + pageSize - 1);

        if (!setsData || setsData.length === 0) break;

        // Get workout dates for these sets
        const workoutIds = [...new Set(setsData.map((s) => s.workout_id))];
        const { data: workoutsData } = await supabase
          .from("workouts")
          .select("id, date")
          .in("id", workoutIds);

        const workoutDateMap = new Map(
          workoutsData?.map((w) => [w.id, w.date]) || []
        );

        setsData.forEach((s) => {
          const workoutDate = workoutDateMap.get(s.workout_id);
          if (workoutDate) {
            const existing = exerciseUsageMap.get(s.exercise_id);
            if (!existing || workoutDate > existing) {
              exerciseUsageMap.set(s.exercise_id, workoutDate);
            }
          }
        });

        if (setsData.length < pageSize) break;
        offset += pageSize;
      }

      // Filter exercises that haven't been used in 30+ days
      // Only include exercises that were created more than 30 days ago
      const unusedExercises = exercises.filter((e) => {
        const lastUsed = exerciseUsageMap.get(e.id);
        const createdAt = e.created_at ? e.created_at.split("T")[0] : null;

        // Skip if exercise was created less than 30 days ago
        if (createdAt && createdAt >= cutoffDate) {
          return false;
        }

        // Include if never used OR last used before cutoff
        return !lastUsed || lastUsed < cutoffDate;
      });

      if (unusedExercises.length === 0) return [];

      // Get user profiles for these exercises
      const userIds = [...new Set(unusedExercises.map((e) => e.user_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar")
        .in("user_id", userIds);

      const profileMap = new Map(
        profiles?.map((p) => [p.user_id, p]) || []
      );

      // Combine exercise data with profile info
      return unusedExercises.map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        user_id: e.user_id!,
        display_name: profileMap.get(e.user_id!)?.display_name || null,
        avatar: profileMap.get(e.user_id!)?.avatar || null,
        last_used_date: exerciseUsageMap.get(e.id) || null,
        created_at: e.created_at,
      }));
    },
  });
}

// Delete unused exercises
export function useDeleteUnusedExercises() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (exerciseIds: string[]): Promise<number> => {
      if (exerciseIds.length === 0) return 0;

      // Get the current session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      // Call the admin-cleanup edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-cleanup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "deleteUnusedExercises", ids: exerciseIds }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete exercises");
      }

      return result.count;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
    },
  });
}
