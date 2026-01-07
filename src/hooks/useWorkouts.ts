import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface WorkoutSet {
  id: string;
  exercise_id: string;
  set_number: number;
  reps: number;
  weight: number | null;
  created_at: string;
  exercise?: {
    id: string;
    name: string;
    type: "bodyweight" | "weighted";
    image_url?: string | null;
  };
}

export interface Workout {
  id: string;
  date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  workout_sets?: WorkoutSet[];
}

export function useWorkouts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["workouts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workouts")
        .select(`
          *,
          workout_sets (
            *,
            exercise:exercises (id, name, type, image_url)
          )
        `)
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
      const { data, error } = await supabase
        .from("workouts")
        .select(`
          *,
          workout_sets (
            *,
            exercise:exercises (id, name, type, image_url)
          )
        `)
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
      const { data, error } = await supabase
        .from("workouts")
        .insert({ date, user_id: user!.id })
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
    }: {
      workoutId: string;
      exerciseId: string;
      setNumber: number;
      reps: number;
      weight?: number;
    }) => {
      const { data, error } = await supabase
        .from("workout_sets")
        .insert({
          workout_id: workoutId,
          exercise_id: exerciseId,
          set_number: setNumber,
          reps,
          weight: weight ?? null,
        })
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
    },
  });
}

export function useUpdateWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workoutId, notes }: { workoutId: string; notes: string }) => {
      const { data, error } = await supabase
        .from("workouts")
        .update({ notes })
        .eq("id", workoutId)
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
