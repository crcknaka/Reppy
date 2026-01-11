import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOffline } from "@/contexts/OfflineContext";
import { offlineDb, generateOfflineId } from "../db";
import { syncQueue } from "../syncQueue";
import type { Workout, WorkoutSet } from "@/hooks/useWorkouts";

// Offline-first useWorkouts hook
export function useOfflineWorkouts() {
  const { user } = useAuth();
  const { isInitialized } = useOffline();

  return useQuery({
    queryKey: ["workouts", user?.id],
    queryFn: async () => {
      // Helper to get workouts from IndexedDB
      const getFromCache = async (): Promise<Workout[] | null> => {
        const workouts = await offlineDb.workouts
          .where("user_id")
          .equals(user!.id)
          .reverse()
          .sortBy("date");

        if (workouts.length === 0) return null;

        // Load workout sets with exercises for each workout
        const workoutsWithSets: Workout[] = await Promise.all(
          workouts.map(async (workout) => {
            const sets = await offlineDb.workoutSets
              .where("workout_id")
              .equals(workout.id)
              .toArray();

            const setsWithExercises: WorkoutSet[] = await Promise.all(
              sets.map(async (set) => {
                const exercise = await offlineDb.exercises.get(set.exercise_id);
                return {
                  id: set.id,
                  workout_id: set.workout_id,
                  exercise_id: set.exercise_id,
                  set_number: set.set_number,
                  reps: set.reps,
                  weight: set.weight,
                  distance_km: set.distance_km,
                  duration_minutes: set.duration_minutes,
                  plank_seconds: set.plank_seconds,
                  created_at: set.created_at,
                  exercise: exercise
                    ? {
                        id: exercise.id,
                        name: exercise.name,
                        type: exercise.type,
                        image_url: exercise.image_url,
                        is_preset: exercise.is_preset,
                        name_translations: exercise.name_translations,
                      }
                    : undefined,
                };
              })
            );

            return {
              id: workout.id,
              user_id: workout.user_id,
              date: workout.date,
              notes: workout.notes,
              photo_url: workout.photo_url,
              created_at: workout.created_at,
              updated_at: workout.updated_at,
              is_locked: workout.is_locked,
              workout_sets: setsWithExercises,
            } as Workout;
          })
        );

        return workoutsWithSets;
      };

      // ALWAYS try cache first - prevents errors on offline transition
      const cachedData = await getFromCache();
      if (cachedData && cachedData.length > 0) {
        // If online, refresh in background but return cached immediately
        if (navigator.onLine) {
          // Fire and forget - update cache in background
          supabase
            .from("workouts")
            .select(`
              *,
              workout_sets (
                id, workout_id, exercise_id, set_number, reps, weight,
                distance_km, duration_minutes, plank_seconds, created_at,
                exercise:exercises (id, name, type, image_url, is_preset, name_translations)
              )
            `)
            .eq("user_id", user!.id)
            .order("date", { ascending: false })
            .then(async ({ data, error }) => {
              if (!error && data) {
                // Update IndexedDB cache silently
                for (const workout of data) {
                  await offlineDb.workouts.put({
                    id: workout.id,
                    user_id: workout.user_id,
                    date: workout.date,
                    notes: workout.notes,
                    photo_url: workout.photo_url,
                    created_at: workout.created_at,
                    updated_at: workout.updated_at,
                    is_locked: workout.is_locked,
                    _synced: true,
                    _lastModified: Date.now(),
                  });
                  if (workout.workout_sets) {
                    for (const set of workout.workout_sets) {
                      await offlineDb.workoutSets.put({
                        id: set.id,
                        workout_id: set.workout_id,
                        exercise_id: set.exercise_id,
                        set_number: set.set_number,
                        reps: set.reps,
                        weight: set.weight,
                        distance_km: set.distance_km,
                        duration_minutes: set.duration_minutes,
                        plank_seconds: set.plank_seconds,
                        created_at: set.created_at,
                        _synced: true,
                        _lastModified: Date.now(),
                      });
                    }
                  }
                }
              }
            });
        }
        return cachedData;
      }

      // No cache - try online fetch
      if (navigator.onLine) {
        try {
          const { data, error } = await supabase
            .from("workouts")
            .select(`
              *,
              workout_sets (
                id, workout_id, exercise_id, set_number, reps, weight,
                distance_km, duration_minutes, plank_seconds, created_at,
                exercise:exercises (id, name, type, image_url, is_preset, name_translations)
              )
            `)
            .eq("user_id", user!.id)
            .order("date", { ascending: false });

          if (!error && data) {
            // Update IndexedDB cache
            for (const workout of data) {
              await offlineDb.workouts.put({
                id: workout.id,
                user_id: workout.user_id,
                date: workout.date,
                notes: workout.notes,
                photo_url: workout.photo_url,
                created_at: workout.created_at,
                updated_at: workout.updated_at,
                is_locked: workout.is_locked,
                _synced: true,
                _lastModified: Date.now(),
              });

              // Cache workout sets
              if (workout.workout_sets) {
                for (const set of workout.workout_sets) {
                  await offlineDb.workoutSets.put({
                    id: set.id,
                    workout_id: set.workout_id,
                    exercise_id: set.exercise_id,
                    set_number: set.set_number,
                    reps: set.reps,
                    weight: set.weight,
                    distance_km: set.distance_km,
                    duration_minutes: set.duration_minutes,
                    plank_seconds: set.plank_seconds,
                    created_at: set.created_at,
                    _synced: true,
                    _lastModified: Date.now(),
                  });
                }
              }
            }
            return data as unknown as Workout[];
          }
        } catch {
          // Fall through to retry cache
        }
      }

      // Last resort - return empty array or retry cache
      const retryData = await getFromCache();
      return retryData || [];
    },
    enabled: !!user && isInitialized,
    staleTime: 1000 * 60 * 5, // 5 minutes - don't refetch too often
    gcTime: 1000 * 60 * 30, // 30 minutes - keep in cache
  });
}

// Offline-first createWorkout mutation
export function useOfflineCreateWorkout() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isOnline } = useOffline();

  return useMutation({
    mutationFn: async (date: string) => {
      const now = new Date().toISOString();
      const offlineId = generateOfflineId();

      // Create local workout first
      const workout = {
        id: offlineId,
        user_id: user!.id,
        date,
        notes: null,
        photo_url: null,
        created_at: now,
        updated_at: now,
        is_locked: false,
        _synced: false,
        _lastModified: Date.now(),
        _offlineId: offlineId,
      };

      await offlineDb.workouts.add(workout);

      // If online, try to sync immediately
      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from("workouts")
            .insert({ date, user_id: user!.id })
            .select()
            .single();

          if (!error && data) {
            // Update local with server data
            await offlineDb.workouts.delete(offlineId);
            await offlineDb.workouts.put({
              ...data,
              _synced: true,
              _lastModified: Date.now(),
            });
            return data;
          }
        } catch {
          // Fall through to queue
        }
      }

      // Queue for later sync
      await syncQueue.enqueue("workouts", "create", offlineId, {
        date,
        user_id: user!.id,
        _offlineId: offlineId,
      });

      return {
        id: offlineId,
        user_id: user!.id,
        date,
        notes: null,
        photo_url: null,
        created_at: now,
        updated_at: now,
        is_locked: false,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
    },
  });
}

// Offline-first addSet mutation
export function useOfflineAddSet() {
  const queryClient = useQueryClient();
  const { isOnline } = useOffline();

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
      const now = new Date().toISOString();
      const offlineId = generateOfflineId();

      // Create local set first
      const set = {
        id: offlineId,
        workout_id: workoutId,
        exercise_id: exerciseId,
        set_number: setNumber,
        reps: reps ?? null,
        weight: weight ?? null,
        distance_km: distance_km ?? null,
        duration_minutes: duration_minutes ?? null,
        plank_seconds: plank_seconds ?? null,
        created_at: now,
        _synced: false,
        _lastModified: Date.now(),
        _offlineId: offlineId,
      };

      await offlineDb.workoutSets.add(set);

      // If online, try to sync immediately
      if (isOnline) {
        try {
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

          if (!error && data) {
            await offlineDb.workoutSets.delete(offlineId);
            await offlineDb.workoutSets.put({
              ...data,
              _synced: true,
              _lastModified: Date.now(),
            });
            return data;
          }
        } catch {
          // Fall through to queue
        }
      }

      // Queue for later sync
      await syncQueue.enqueue("workout_sets", "create", offlineId, {
        workout_id: workoutId,
        exercise_id: exerciseId,
        set_number: setNumber,
        reps: reps ?? null,
        weight: weight ?? null,
        distance_km: distance_km ?? null,
        duration_minutes: duration_minutes ?? null,
        plank_seconds: plank_seconds ?? null,
        _offlineId: offlineId,
      });

      return set;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["workout"] });
    },
  });
}

// Offline-first updateSet mutation
export function useOfflineUpdateSet() {
  const queryClient = useQueryClient();
  const { isOnline } = useOffline();

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
      // Update local first
      await offlineDb.workoutSets.update(setId, {
        reps: reps ?? null,
        weight: weight ?? null,
        distance_km: distance_km ?? null,
        duration_minutes: duration_minutes ?? null,
        plank_seconds: plank_seconds ?? null,
        _synced: false,
        _lastModified: Date.now(),
      });

      // If online, try to sync immediately
      if (isOnline) {
        try {
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

          if (!error && data) {
            await offlineDb.workoutSets.update(setId, {
              ...data,
              _synced: true,
              _lastModified: Date.now(),
            });
            return data;
          }
        } catch {
          // Fall through to queue
        }
      }

      // Queue for later sync
      await syncQueue.enqueue("workout_sets", "update", setId, {
        reps: reps ?? null,
        weight: weight ?? null,
        distance_km: distance_km ?? null,
        duration_minutes: duration_minutes ?? null,
        plank_seconds: plank_seconds ?? null,
      });

      return await offlineDb.workoutSets.get(setId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["workout"] });
    },
  });
}

// Offline-first deleteSet mutation
export function useOfflineDeleteSet() {
  const queryClient = useQueryClient();
  const { isOnline } = useOffline();

  return useMutation({
    mutationFn: async (setId: string) => {
      // Get set data before deleting
      const set = await offlineDb.workoutSets.get(setId);

      // Delete locally first
      await offlineDb.workoutSets.delete(setId);

      // If online, try to sync immediately
      if (isOnline) {
        try {
          const { error } = await supabase
            .from("workout_sets")
            .delete()
            .eq("id", setId);

          if (!error) {
            // Remove any pending queue items for this set
            await syncQueue.removeByEntity(setId);
            return;
          }
        } catch {
          // Fall through to queue
        }
      }

      // Queue for later sync
      await syncQueue.enqueue("workout_sets", "delete", setId, {
        id: setId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["workout"] });
    },
  });
}

// Offline-first deleteWorkout mutation
export function useOfflineDeleteWorkout() {
  const queryClient = useQueryClient();
  const { isOnline } = useOffline();

  return useMutation({
    mutationFn: async (workoutId: string) => {
      // Delete workout sets first
      const sets = await offlineDb.workoutSets
        .where("workout_id")
        .equals(workoutId)
        .toArray();

      for (const set of sets) {
        await offlineDb.workoutSets.delete(set.id);
        await syncQueue.removeByEntity(set.id);
      }

      // Delete workout
      await offlineDb.workouts.delete(workoutId);

      // If online, try to sync immediately
      if (isOnline) {
        try {
          const { error } = await supabase
            .from("workouts")
            .delete()
            .eq("id", workoutId);

          if (!error) {
            await syncQueue.removeByEntity(workoutId);
            return;
          }
        } catch {
          // Fall through to queue
        }
      }

      // Queue for later sync
      await syncQueue.enqueue("workouts", "delete", workoutId, {
        id: workoutId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
    },
  });
}

// Offline-first useSingleWorkout hook
export function useOfflineSingleWorkout(workoutId: string | undefined) {
  const { isInitialized } = useOffline();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["workout", workoutId],
    queryFn: async () => {
      // Helper to get workout from cache/IndexedDB
      const getFromCache = async (): Promise<Workout | null> => {
        // First try React Query cache (from workouts list)
        const cachedWorkouts = queryClient.getQueryData<Workout[]>(["workouts"]);
        if (cachedWorkouts) {
          const cachedWorkout = cachedWorkouts.find((w) => w.id === workoutId);
          if (cachedWorkout) {
            return cachedWorkout;
          }
        }

        // Then try IndexedDB
        const workout = await offlineDb.workouts.get(workoutId!);
        if (!workout) return null;

        // Load workout sets with exercises
        const sets = await offlineDb.workoutSets
          .where("workout_id")
          .equals(workoutId!)
          .toArray();

        const setsWithExercises: WorkoutSet[] = await Promise.all(
          sets.map(async (set) => {
            const exercise = await offlineDb.exercises.get(set.exercise_id);
            return {
              id: set.id,
              workout_id: set.workout_id,
              exercise_id: set.exercise_id,
              set_number: set.set_number,
              reps: set.reps,
              weight: set.weight,
              distance_km: set.distance_km,
              duration_minutes: set.duration_minutes,
              plank_seconds: set.plank_seconds,
              created_at: set.created_at,
              exercise: exercise
                ? {
                    id: exercise.id,
                    name: exercise.name,
                    type: exercise.type,
                    image_url: exercise.image_url,
                    is_preset: exercise.is_preset,
                    name_translations: exercise.name_translations,
                  }
                : undefined,
            };
          })
        );

        return {
          id: workout.id,
          user_id: workout.user_id,
          date: workout.date,
          notes: workout.notes,
          photo_url: workout.photo_url,
          created_at: workout.created_at,
          updated_at: workout.updated_at,
          is_locked: workout.is_locked,
          workout_sets: setsWithExercises,
        } as Workout;
      };

      // ALWAYS try cache first - this prevents "not found" on offline transition
      const cachedData = await getFromCache();
      if (cachedData) {
        // If online, refresh in background but return cached immediately
        if (navigator.onLine) {
          // Fire and forget - update cache in background
          supabase
            .from("workouts")
            .select(`
              *,
              workout_sets (
                id, workout_id, exercise_id, set_number, reps, weight,
                distance_km, duration_minutes, plank_seconds, created_at,
                exercise:exercises (id, name, type, image_url, is_preset, name_translations)
              )
            `)
            .eq("id", workoutId!)
            .single()
            .then(async ({ data, error }) => {
              if (!error && data) {
                // Update IndexedDB cache silently
                await offlineDb.workouts.put({
                  id: data.id,
                  user_id: data.user_id,
                  date: data.date,
                  notes: data.notes,
                  photo_url: data.photo_url,
                  created_at: data.created_at,
                  updated_at: data.updated_at,
                  is_locked: data.is_locked,
                  _synced: true,
                  _lastModified: Date.now(),
                });
                if (data.workout_sets) {
                  for (const set of data.workout_sets) {
                    await offlineDb.workoutSets.put({
                      id: set.id,
                      workout_id: set.workout_id,
                      exercise_id: set.exercise_id,
                      set_number: set.set_number,
                      reps: set.reps,
                      weight: set.weight,
                      distance_km: set.distance_km,
                      duration_minutes: set.duration_minutes,
                      plank_seconds: set.plank_seconds,
                      created_at: set.created_at,
                      _synced: true,
                      _lastModified: Date.now(),
                    });
                  }
                }
              }
            });
        }
        return cachedData;
      }

      // No cache - try online fetch
      if (navigator.onLine) {
        try {
          const { data, error } = await supabase
            .from("workouts")
            .select(`
              *,
              workout_sets (
                id, workout_id, exercise_id, set_number, reps, weight,
                distance_km, duration_minutes, plank_seconds, created_at,
                exercise:exercises (id, name, type, image_url, is_preset, name_translations)
              )
            `)
            .eq("id", workoutId!)
            .single();

          if (!error && data) {
            // Update IndexedDB cache
            await offlineDb.workouts.put({
              id: data.id,
              user_id: data.user_id,
              date: data.date,
              notes: data.notes,
              photo_url: data.photo_url,
              created_at: data.created_at,
              updated_at: data.updated_at,
              is_locked: data.is_locked,
              _synced: true,
              _lastModified: Date.now(),
            });

            if (data.workout_sets) {
              for (const set of data.workout_sets) {
                await offlineDb.workoutSets.put({
                  id: set.id,
                  workout_id: set.workout_id,
                  exercise_id: set.exercise_id,
                  set_number: set.set_number,
                  reps: set.reps,
                  weight: set.weight,
                  distance_km: set.distance_km,
                  duration_minutes: set.duration_minutes,
                  plank_seconds: set.plank_seconds,
                  created_at: set.created_at,
                  _synced: true,
                  _lastModified: Date.now(),
                });
              }
            }
            return data as unknown as Workout;
          }
        } catch {
          // Fall through to retry cache
        }
      }

      // Last resort - retry cache with delays (DB may still be syncing)
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        const retryData = await getFromCache();
        if (retryData) return retryData;
      }

      throw new Error("Workout not found");
    },
    enabled: !!workoutId && isInitialized,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    // Retry a few times when offline - IndexedDB may need time
    retry: (failureCount) => {
      if (!navigator.onLine && failureCount < 3) return true;
      return false;
    },
    retryDelay: 500,
  });
}

// Offline-first updateWorkout mutation
export function useOfflineUpdateWorkout() {
  const queryClient = useQueryClient();
  const { isOnline } = useOffline();

  return useMutation({
    mutationFn: async ({
      workoutId,
      notes,
      photo_url,
    }: {
      workoutId: string;
      notes?: string;
      photo_url?: string | null;
    }) => {
      const updateData: Record<string, unknown> = {};
      if (notes !== undefined) updateData.notes = notes;
      if (photo_url !== undefined) updateData.photo_url = photo_url;

      // Update local first
      await offlineDb.workouts.update(workoutId, {
        ...updateData,
        _synced: false,
        _lastModified: Date.now(),
      });

      // If online, try to sync immediately
      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from("workouts")
            .update(updateData)
            .eq("id", workoutId)
            .select()
            .single();

          if (!error && data) {
            await offlineDb.workouts.update(workoutId, {
              ...data,
              _synced: true,
              _lastModified: Date.now(),
            });
            return data;
          }
        } catch {
          // Fall through to queue
        }
      }

      // Queue for later sync
      await syncQueue.enqueue("workouts", "update", workoutId, updateData);

      return await offlineDb.workouts.get(workoutId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      queryClient.invalidateQueries({ queryKey: ["workout"] });
    },
  });
}
