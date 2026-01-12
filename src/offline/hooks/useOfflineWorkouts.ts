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
      if (!user?.id) throw new Error("User not authenticated");

      // Helper to get workouts from IndexedDB
      const getFromCache = async (): Promise<Workout[] | null> => {
        const workouts = await offlineDb.workouts
          .where("user_id")
          .equals(user.id)
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

      // If online, fetch from server and sync cache
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
            .eq("user_id", user.id)
            .order("date", { ascending: false });

          if (!error && data) {
            // Get current cached workout IDs
            const cachedWorkouts = await offlineDb.workouts
              .where("user_id")
              .equals(user.id)
              .toArray();
            const cachedIds = new Set(cachedWorkouts.map((w) => w.id));
            const serverIds = new Set(data.map((w) => w.id));

            // Delete workouts that exist in cache but not on server (deleted on another device)
            for (const cachedId of cachedIds) {
              if (!serverIds.has(cachedId) && !cachedId.startsWith("offline_")) {
                await offlineDb.workoutSets
                  .where("workout_id")
                  .equals(cachedId)
                  .delete();
                await offlineDb.workouts.delete(cachedId);
              }
            }

            // Update cache with server data
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

              // Get current cached set IDs for this workout
              const cachedSets = await offlineDb.workoutSets
                .where("workout_id")
                .equals(workout.id)
                .toArray();
              const cachedSetIds = new Set(cachedSets.map((s) => s.id));
              const serverSetIds = new Set(
                (workout.workout_sets || []).map((s: any) => s.id)
              );

              // Delete sets that exist in cache but not on server
              for (const cachedSetId of cachedSetIds) {
                if (!serverSetIds.has(cachedSetId) && !cachedSetId.startsWith("offline_")) {
                  await offlineDb.workoutSets.delete(cachedSetId);
                }
              }

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
          // Network error - fall through to cache
        }
      }

      // Offline or network error - use cache
      const cachedData = await getFromCache();
      return cachedData || [];
    },
    enabled: !!user && isInitialized,
    staleTime: 0, // Always refetch on mount to get latest data
    gcTime: 1000 * 60 * 30, // 30 minutes - keep in cache
    refetchOnMount: "always", // Force fresh fetch on every mount/page refresh
  });
}

// Offline-first createWorkout mutation
export function useOfflineCreateWorkout() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isOnline } = useOffline();

  return useMutation({
    mutationFn: async (date: string) => {
      if (!user?.id) throw new Error("User not authenticated");

      const now = new Date().toISOString();
      const offlineId = generateOfflineId();

      // Create local workout first
      const workout = {
        id: offlineId,
        user_id: user.id,
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
            .insert({ date, user_id: user.id })
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
        user_id: user.id,
        _offlineId: offlineId,
      });

      return {
        id: offlineId,
        user_id: user.id,
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

  return useQuery({
    queryKey: ["workout", workoutId],
    queryFn: async () => {
      // Helper to get workout from IndexedDB only (no React Query cache to avoid stale data)
      const getFromIndexedDB = async (): Promise<Workout | null> => {
        const workout = await offlineDb.workouts.get(workoutId || '');
        if (!workout) return null;

        // Load workout sets with exercises
        const sets = await offlineDb.workoutSets
          .where("workout_id")
          .equals(workoutId || '')
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

      // Check if this is an offline-created workout that hasn't been synced yet
      const isOfflineWorkout = workoutId?.startsWith("offline_");

      // For offline-created workouts, use IndexedDB directly (server doesn't know about them yet)
      if (isOfflineWorkout) {
        const cachedData = await getFromIndexedDB();
        if (cachedData) {
          return cachedData;
        }
        throw new Error("Workout not found");
      }

      // For server-synced workouts: ALWAYS check server first when online
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
            .eq("id", workoutId)
            .single();

          if (error) {
            // Workout not found on server (deleted on another device)
            // Remove from local IndexedDB cache
            await offlineDb.workoutSets
              .where("workout_id")
              .equals(workoutId || "")
              .delete();
            await offlineDb.workouts.delete(workoutId || "");
            throw new Error("Workout not found");
          }

          if (data) {
            // Update IndexedDB cache with server data
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
        } catch (err) {
          // If error is "Workout not found", rethrow it
          if (err instanceof Error && err.message === "Workout not found") {
            throw err;
          }
          // Network error (timeout, DNS, etc.) - fall through to IndexedDB cache
        }
      }

      // Offline or network error - try IndexedDB cache
      const cachedData = await getFromIndexedDB();
      if (cachedData) {
        return cachedData;
      }

      throw new Error("Workout not found");
    },
    enabled: !!workoutId && isInitialized,
    staleTime: 0, // Always refetch to check if workout still exists
    gcTime: 1000 * 60 * 30,
    // Completely disable React Query caching for this query to force fresh fetch
    refetchOnMount: "always",
    // Don't retry if workout not found
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message === "Workout not found") {
        return false;
      }
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
