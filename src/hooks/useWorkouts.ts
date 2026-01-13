import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { offlineDb } from "@/offline/db";
import { syncQueue } from "@/offline/syncQueue";
import type { ExerciseTranslations } from "./useExercises";

export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise_id: string;
  set_number: number;
  reps: number | null;
  weight: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  plank_seconds: number | null;
  created_at: string;
  exercise?: {
    id: string;
    name: string;
    type: "bodyweight" | "weighted" | "cardio" | "timed";
    image_url?: string | null;
    is_preset?: boolean;
    name_translations?: ExerciseTranslations | null;
  };
}

export interface Workout {
  id: string;
  user_id: string;
  date: string;
  notes: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
  is_locked: boolean;
  workout_sets?: WorkoutSet[];
}

export function useWorkouts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["workouts", user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("workouts")
        .select(`
          *,
          workout_sets (
            id,
            workout_id,
            exercise_id,
            set_number,
            reps,
            weight,
            distance_km,
            duration_minutes,
            plank_seconds,
            created_at,
            exercise:exercises (id, name, type, image_url, is_preset, name_translations)
          )
        `)
        .eq('user_id', user.id)
        .order("date", { ascending: false });

      if (error) throw error;
      return data as Workout[];
    },
    enabled: !!user,
  });
}

export function useWorkoutsByMonth(year: number, month: number) {
  const { user } = useAuth();
  const startDate = new Date(year, month, 1).toISOString().split("T")[0];
  const endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];

  return useQuery({
    queryKey: ["workouts", user?.id, year, month],
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("workouts")
        .select(`
          *,
          workout_sets (
            id,
            workout_id,
            exercise_id,
            set_number,
            reps,
            weight,
            distance_km,
            duration_minutes,
            plank_seconds,
            created_at,
            exercise:exercises (id, name, type, image_url, is_preset, name_translations)
          )
        `)
        .eq('user_id', user.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (error) throw error;
      return data as Workout[];
    },
    enabled: !!user,
  });
}

export function useCreateWorkout() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (date: string) => {
      if (!user?.id) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("workouts")
        .insert({ date, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
    },
  });
}

export function useDeleteWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workoutId: string) => {
      const { error } = await supabase
        .from("workouts")
        .delete()
        .eq("id", workoutId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
    },
  });
}

export function useAddSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workoutId,
      exerciseId,
      setNumber,
      reps,
      weight,
      distance_km,
      duration_minutes,
      plank_seconds,
    }: {
      workoutId: string;
      exerciseId: string;
      setNumber: number;
      reps?: number;
      weight?: number;
      distance_km?: number;
      duration_minutes?: number;
      plank_seconds?: number;
    }) => {
      const { data, error } = await supabase
        .from("workout_sets")
        .insert({
          workout_id: workoutId,
          exercise_id: exerciseId,
          set_number: setNumber,
          reps: reps ?? null,
          weight: weight ?? null,
          distance_km: distance_km ?? null,
          duration_minutes: duration_minutes ?? null,
          plank_seconds: plank_seconds ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["workout"] });
    },
  });
}

export function useDeleteSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (setId: string) => {
      const { error } = await supabase
        .from("workout_sets")
        .delete()
        .eq("id", setId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["workout"] });
    },
  });
}

export function useUpdateSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      setId,
      reps,
      weight,
      distance_km,
      duration_minutes,
      plank_seconds,
    }: {
      setId: string;
      reps?: number | null;
      weight?: number | null;
      distance_km?: number | null;
      duration_minutes?: number | null;
      plank_seconds?: number | null;
    }) => {
      const { data, error } = await supabase
        .from("workout_sets")
        .update({
          reps: reps ?? null,
          weight: weight ?? null,
          distance_km: distance_km ?? null,
          duration_minutes: duration_minutes ?? null,
          plank_seconds: plank_seconds ?? null,
        })
        .eq("id", setId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["workout"] });
    },
  });
}

export function useUpdateWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workoutId, notes, photo_url }: { workoutId: string; notes?: string; photo_url?: string | null }) => {
      const updateData: { notes?: string; photo_url?: string | null } = {};
      if (notes !== undefined) updateData.notes = notes;
      if (photo_url !== undefined) updateData.photo_url = photo_url;

      const { data, error } = await supabase
        .from("workouts")
        .update(updateData)
        .eq("id", workoutId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["workout"] });
    },
  });
}

export function useUserWorkouts(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["workouts", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");
      if (!navigator.onLine) return [];

      const { data, error } = await supabase
        .from("workouts")
        .select(`
          *,
          workout_sets (
            id,
            workout_id,
            exercise_id,
            set_number,
            reps,
            weight,
            distance_km,
            duration_minutes,
            plank_seconds,
            created_at,
            exercise:exercises (id, name, type, image_url, is_preset, name_translations)
          )
        `)
        .eq('user_id', userId)
        .order("date", { ascending: false });

      if (error) throw error;
      return data as Workout[];
    },
    enabled: !!userId,
  });
}

export function useSingleWorkout(workoutId: string | undefined) {
  return useQuery({
    queryKey: ["workout", workoutId],
    queryFn: async () => {
      if (!workoutId) throw new Error("Workout ID is required");

      const { data, error } = await supabase
        .from("workouts")
        .select(`
          *,
          workout_sets (
            id,
            workout_id,
            exercise_id,
            set_number,
            reps,
            weight,
            distance_km,
            duration_minutes,
            plank_seconds,
            created_at,
            exercise:exercises (id, name, type, image_url, is_preset, name_translations)
          )
        `)
        .eq('id', workoutId)
        .single();

      if (error) throw error;
      return data as Workout;
    },
    enabled: !!workoutId,
  });
}

export function useUserAllTimeBests(userId: string | null | undefined, excludeWorkoutId?: string) {
  return useQuery({
    queryKey: ["user-all-time-bests", userId, excludeWorkoutId],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");
      if (!navigator.onLine) return {};

      const { data, error } = await supabase
        .from("workout_sets")
        .select(`
          id,
          exercise_id,
          reps,
          weight,
          distance_km,
          duration_minutes,
          plank_seconds,
          workout_id,
          workout:workouts!inner(user_id),
          exercise:exercises(id, name, type, is_preset, name_translations)
        `)
        .eq('workout.user_id', userId);

      if (error) throw error;

      // Group by exercise and find max values (excluding current workout)
      const bestsByExercise: Record<string, {
        exerciseType: string;
        maxWeight?: number;
        maxReps?: number;
        maxDistance?: number;
        maxSeconds?: number;
      }> = {};

      data?.forEach((set: any) => {
        // Skip sets from the current workout to compare against historical data only
        if (excludeWorkoutId && set.workout_id === excludeWorkoutId) {
          return;
        }

        const exerciseId = set.exercise_id;
        const exerciseType = set.exercise?.type;

        if (!bestsByExercise[exerciseId]) {
          bestsByExercise[exerciseId] = { exerciseType };
        }

        const current = bestsByExercise[exerciseId];

        switch (exerciseType) {
          case "weighted":
            if (set.weight && (!current.maxWeight || set.weight > current.maxWeight)) {
              current.maxWeight = set.weight;
            }
            break;
          case "bodyweight":
            if (set.reps && (!current.maxReps || set.reps > current.maxReps)) {
              current.maxReps = set.reps;
            }
            break;
          case "cardio":
            if (set.distance_km && (!current.maxDistance || set.distance_km > current.maxDistance)) {
              current.maxDistance = set.distance_km;
            }
            break;
          case "timed":
            if (set.plank_seconds && (!current.maxSeconds || set.plank_seconds > current.maxSeconds)) {
              current.maxSeconds = set.plank_seconds;
            }
            break;
        }
      });

      return bestsByExercise;
    },
    enabled: !!userId,
  });
}

export function useLockWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workoutId: string) => {
      // Update IndexedDB first for immediate UI update
      await offlineDb.workouts.update(workoutId, {
        is_locked: true,
        _synced: false,
        _lastModified: Date.now()
      });

      // If offline, queue for sync later
      if (!navigator.onLine) {
        await syncQueue.enqueue("workouts", "update", workoutId, { is_locked: true });
        return { id: workoutId, is_locked: true };
      }

      const { data, error } = await supabase
        .from("workouts")
        .update({ is_locked: true })
        .eq("id", workoutId)
        .select()
        .single();

      if (error) {
        // Rollback IndexedDB on error
        await offlineDb.workouts.update(workoutId, {
          is_locked: false,
          _lastModified: Date.now()
        });
        throw error;
      }

      // Mark as synced
      await offlineDb.workouts.update(workoutId, { _synced: true });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["workout"], exact: false });
    },
  });
}

export function useUnlockWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workoutId: string) => {
      // Update IndexedDB first for immediate UI update
      await offlineDb.workouts.update(workoutId, {
        is_locked: false,
        _synced: false,
        _lastModified: Date.now()
      });

      // If offline, queue for sync later
      if (!navigator.onLine) {
        await syncQueue.enqueue("workouts", "update", workoutId, { is_locked: false });
        return { id: workoutId, is_locked: false };
      }

      const { data, error } = await supabase
        .from("workouts")
        .update({ is_locked: false })
        .eq("id", workoutId)
        .select()
        .single();

      if (error) {
        // Rollback IndexedDB on error
        await offlineDb.workouts.update(workoutId, {
          is_locked: true,
          _lastModified: Date.now()
        });
        throw error;
      }

      // Mark as synced
      await offlineDb.workouts.update(workoutId, { _synced: true });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["workout"], exact: false });
    },
  });
}
