import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOffline } from "@/contexts/OfflineContext";
import { offlineDb, generateOfflineId } from "../db";
import { syncQueue } from "../syncQueue";
import type { Exercise } from "@/hooks/useExercises";

// Offline-first useExercises hook
export function useOfflineExercises() {
  const { effectiveUserId, isGuest } = useAuth();
  const { isOnline, isInitialized } = useOffline();

  return useQuery({
    queryKey: ["exercises", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) throw new Error("User not authenticated");

      // Helper to get exercises from IndexedDB
      const getFromCache = async (): Promise<Exercise[]> => {
        const exercises = await offlineDb.exercises
          .filter(
            (e) =>
              e.is_preset ||
              e.user_id === effectiveUserId ||
              e.user_id === null
          )
          .sortBy("name");
        return exercises as Exercise[];
      };

      // For authenticated users: try online first
      if (isOnline && !isGuest) {
        try {
          const { data, error } = await supabase
            .from("exercises")
            .select("*")
            .or(`is_preset.eq.true,user_id.eq.${effectiveUserId}`)
            .order("name");

          if (!error && data) {
            // Update IndexedDB cache
            await offlineDb.exercises.bulkPut(
              data.map((e) => ({
                ...e,
                name_translations: (e as any).name_translations ?? null,
                _synced: true,
              }))
            );

            return data as Exercise[];
          }
        } catch {
          // Fall through to offline data
        }
      }

      // For guests: load preset exercises from server if cache is empty
      if (isGuest && isOnline) {
        const cachedExercises = await getFromCache();
        const hasPresets = cachedExercises.some(e => e.is_preset);

        if (!hasPresets) {
          try {
            // Fetch only preset exercises for guests
            const { data, error } = await supabase
              .from("exercises")
              .select("*")
              .eq("is_preset", true)
              .order("name");

            if (!error && data) {
              // Cache preset exercises in IndexedDB
              await offlineDb.exercises.bulkPut(
                data.map((e) => ({
                  ...e,
                  name_translations: (e as any).name_translations ?? null,
                  _synced: true,
                }))
              );

              // Add user's custom exercises from cache
              const userExercises = cachedExercises.filter(e => e.user_id === effectiveUserId);
              return [...data, ...userExercises] as Exercise[];
            }
          } catch {
            // Fall through to cached data
          }
        }
      }

      // Use offline data (for guests offline or when network fails)
      return await getFromCache();
    },
    enabled: !!effectiveUserId && isInitialized,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

// Offline-first createExercise mutation
export function useOfflineCreateExercise() {
  const queryClient = useQueryClient();
  const { effectiveUserId, isGuest } = useAuth();
  const { isOnline } = useOffline();

  return useMutation({
    mutationFn: async ({
      name,
      type,
    }: {
      name: string;
      type: "bodyweight" | "weighted" | "cardio" | "timed";
    }) => {
      if (!effectiveUserId) throw new Error("User not authenticated");

      const now = new Date().toISOString();
      const offlineId = generateOfflineId();

      // Create local exercise first
      const exercise = {
        id: offlineId,
        name,
        type,
        is_preset: false,
        user_id: effectiveUserId,
        image_url: null,
        created_at: now,
        name_translations: null,
        _synced: false,
      };

      await offlineDb.exercises.add(exercise);

      // If online and not guest, try to sync immediately
      if (isOnline && !isGuest) {
        try {
          const { data, error } = await supabase
            .from("exercises")
            .insert({
              name,
              type,
              is_preset: false,
              user_id: effectiveUserId,
            })
            .select()
            .single();

          if (!error && data) {
            await offlineDb.exercises.delete(offlineId);
            await offlineDb.exercises.put({
              ...data,
              name_translations: null,
              _synced: true,
            });
            return data;
          }
        } catch {
          // Fall through to queue
        }
      }

      // Queue for later sync (only for authenticated users)
      if (!isGuest) {
        await syncQueue.enqueue("exercises", "create", offlineId, {
          name,
          type,
          is_preset: false,
          user_id: effectiveUserId,
          _offlineId: offlineId,
        });
      }

      return exercise as unknown as Exercise;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
    },
  });
}

// Offline-first deleteExercise mutation
export function useOfflineDeleteExercise() {
  const queryClient = useQueryClient();
  const { isOnline } = useOffline();
  const { isGuest } = useAuth();

  return useMutation({
    mutationFn: async (exerciseId: string) => {
      // Delete locally first
      await offlineDb.exercises.delete(exerciseId);

      // If online and not guest, try to sync immediately
      if (isOnline && !isGuest) {
        try {
          const { error } = await supabase
            .from("exercises")
            .delete()
            .eq("id", exerciseId);

          if (!error) {
            await syncQueue.removeByEntity(exerciseId);
            return;
          }
        } catch {
          // Fall through to queue
        }
      }

      // Queue for later sync (only for authenticated users)
      if (!isGuest) {
        await syncQueue.enqueue("exercises", "delete", exerciseId, {
          id: exerciseId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
    },
  });
}

// Offline-first favorite exercises hook
export function useOfflineFavoriteExercises() {
  const { effectiveUserId, isGuest } = useAuth();
  const { isOnline, isInitialized } = useOffline();

  return useQuery({
    queryKey: ["favoriteExercises", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) throw new Error("User not authenticated");

      // Try online first if available (for authenticated users only)
      if (isOnline && !isGuest) {
        try {
          const { data, error } = await supabase
            .from("favorite_exercises")
            .select("exercise_id")
            .eq("user_id", effectiveUserId);

          if (!error && data) {
            // Update IndexedDB cache
            const favorites = data.map((f) => ({
              id: f.exercise_id,
              exercise_id: f.exercise_id,
              user_id: effectiveUserId,
              created_at: new Date().toISOString(),
              _synced: true,
            }));

            // Clear and repopulate
            await offlineDb.favoriteExercises
              .where("user_id")
              .equals(effectiveUserId)
              .delete();
            await offlineDb.favoriteExercises.bulkPut(favorites);

            return new Set(data.map((f) => f.exercise_id));
          }
        } catch {
          // Fall through to offline data
        }
      }

      // Use offline data
      const favorites = await offlineDb.favoriteExercises
        .where("user_id")
        .equals(effectiveUserId)
        .toArray();

      return new Set(favorites.map((f) => f.exercise_id));
    },
    enabled: !!effectiveUserId && isInitialized,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

// Offline-first toggle favorite mutation
export function useOfflineToggleFavoriteExercise() {
  const queryClient = useQueryClient();
  const { effectiveUserId, isGuest } = useAuth();
  const { isOnline } = useOffline();

  return useMutation({
    mutationFn: async ({
      exerciseId,
      isFavorite,
    }: {
      exerciseId: string;
      isFavorite: boolean;
    }) => {
      if (!effectiveUserId) throw new Error("User not authenticated");

      if (isFavorite) {
        // Remove from favorites
        const existing = await offlineDb.favoriteExercises
          .where("exercise_id")
          .equals(exerciseId)
          .first();

        if (existing) {
          await offlineDb.favoriteExercises.delete(existing.id);

          if (isOnline && !isGuest) {
            try {
              await supabase
                .from("favorite_exercises")
                .delete()
                .eq("exercise_id", exerciseId)
                .eq("user_id", effectiveUserId);

              await syncQueue.removeByEntity(existing.id);
              return;
            } catch {
              // Fall through to queue
            }
          }

          if (!isGuest) {
            await syncQueue.enqueue("favorite_exercises", "delete", existing.id, {
              id: existing.id,
            });
          }
        }
      } else {
        // Add to favorites
        const offlineId = generateOfflineId();
        const now = new Date().toISOString();

        await offlineDb.favoriteExercises.add({
          id: offlineId,
          exercise_id: exerciseId,
          user_id: effectiveUserId,
          created_at: now,
          _synced: false,
        });

        if (isOnline && !isGuest) {
          try {
            const { data, error } = await supabase
              .from("favorite_exercises")
              .insert({
                exercise_id: exerciseId,
                user_id: effectiveUserId,
              })
              .select()
              .single();

            if (!error && data) {
              await offlineDb.favoriteExercises.delete(offlineId);
              await offlineDb.favoriteExercises.put({
                ...data,
                _synced: true,
              });
              return;
            }
          } catch {
            // Fall through to queue
          }
        }

        if (!isGuest) {
          await syncQueue.enqueue("favorite_exercises", "create", offlineId, {
            exercise_id: exerciseId,
            user_id: effectiveUserId,
            _offlineId: offlineId,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favoriteExercises"] });
    },
  });
}
