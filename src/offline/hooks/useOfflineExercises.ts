import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOffline } from "@/contexts/OfflineContext";
import { offlineDb, generateOfflineId } from "../db";
import { syncQueue } from "../syncQueue";
import type { Exercise } from "@/hooks/useExercises";

// Offline-first useExercises hook
export function useOfflineExercises() {
  const { user } = useAuth();
  const { isOnline, isInitialized } = useOffline();

  return useQuery({
    queryKey: ["exercises", user?.id],
    queryFn: async () => {
      // Try online first if available
      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from("exercises")
            .select("*")
            .or(`is_preset.eq.true,user_id.eq.${user!.id}`)
            .order("name");

          if (!error && data) {
            // Update IndexedDB cache
            await offlineDb.exercises.bulkPut(
              data.map((e) => ({
                ...e,
                name_translations: null,
                _synced: true,
              }))
            );

            return data as Exercise[];
          }
        } catch {
          // Fall through to offline data
        }
      }

      // Use offline data
      const exercises = await offlineDb.exercises
        .filter(
          (e) =>
            e.is_preset ||
            e.user_id === user!.id ||
            e.user_id === null
        )
        .sortBy("name");

      return exercises as Exercise[];
    },
    enabled: !!user && isInitialized,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

// Offline-first createExercise mutation
export function useOfflineCreateExercise() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isOnline } = useOffline();

  return useMutation({
    mutationFn: async ({
      name,
      type,
    }: {
      name: string;
      type: "bodyweight" | "weighted" | "cardio" | "timed";
    }) => {
      const now = new Date().toISOString();
      const offlineId = generateOfflineId();

      // Create local exercise first
      const exercise = {
        id: offlineId,
        name,
        type,
        is_preset: false,
        user_id: user!.id,
        image_url: null,
        created_at: now,
        name_translations: null,
        _synced: false,
      };

      await offlineDb.exercises.add(exercise);

      // If online, try to sync immediately
      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from("exercises")
            .insert({
              name,
              type,
              is_preset: false,
              user_id: user!.id,
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

      // Queue for later sync
      await syncQueue.enqueue("exercises", "create", offlineId, {
        name,
        type,
        is_preset: false,
        user_id: user!.id,
        _offlineId: offlineId,
      });

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

  return useMutation({
    mutationFn: async (exerciseId: string) => {
      // Delete locally first
      await offlineDb.exercises.delete(exerciseId);

      // If online, try to sync immediately
      if (isOnline) {
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

      // Queue for later sync
      await syncQueue.enqueue("exercises", "delete", exerciseId, {
        id: exerciseId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
    },
  });
}

// Offline-first favorite exercises hook
export function useOfflineFavoriteExercises() {
  const { user } = useAuth();
  const { isOnline, isInitialized } = useOffline();

  return useQuery({
    queryKey: ["favoriteExercises", user?.id],
    queryFn: async () => {
      // Try online first if available
      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from("favorite_exercises")
            .select("exercise_id")
            .eq("user_id", user!.id);

          if (!error && data) {
            // Update IndexedDB cache
            const favorites = data.map((f) => ({
              id: f.exercise_id,
              exercise_id: f.exercise_id,
              user_id: user!.id,
              created_at: new Date().toISOString(),
              _synced: true,
            }));

            // Clear and repopulate
            await offlineDb.favoriteExercises
              .where("user_id")
              .equals(user!.id)
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
        .equals(user!.id)
        .toArray();

      return new Set(favorites.map((f) => f.exercise_id));
    },
    enabled: !!user && isInitialized,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

// Offline-first toggle favorite mutation
export function useOfflineToggleFavoriteExercise() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isOnline } = useOffline();

  return useMutation({
    mutationFn: async ({
      exerciseId,
      isFavorite,
    }: {
      exerciseId: string;
      isFavorite: boolean;
    }) => {
      if (isFavorite) {
        // Remove from favorites
        const existing = await offlineDb.favoriteExercises
          .where("exercise_id")
          .equals(exerciseId)
          .first();

        if (existing) {
          await offlineDb.favoriteExercises.delete(existing.id);

          if (isOnline) {
            try {
              await supabase
                .from("favorite_exercises")
                .delete()
                .eq("exercise_id", exerciseId)
                .eq("user_id", user!.id);

              await syncQueue.removeByEntity(existing.id);
              return;
            } catch {
              // Fall through to queue
            }
          }

          await syncQueue.enqueue("favorite_exercises", "delete", existing.id, {
            id: existing.id,
          });
        }
      } else {
        // Add to favorites
        const offlineId = generateOfflineId();
        const now = new Date().toISOString();

        await offlineDb.favoriteExercises.add({
          id: offlineId,
          exercise_id: exerciseId,
          user_id: user!.id,
          created_at: now,
          _synced: false,
        });

        if (isOnline) {
          try {
            const { data, error } = await supabase
              .from("favorite_exercises")
              .insert({
                exercise_id: exerciseId,
                user_id: user!.id,
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

        await syncQueue.enqueue("favorite_exercises", "create", offlineId, {
          exercise_id: exerciseId,
          user_id: user!.id,
          _offlineId: offlineId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favoriteExercises"] });
    },
  });
}
