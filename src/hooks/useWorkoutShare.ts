import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface WorkoutShare {
  id: string;
  workout_id: string;
  user_id: string;
  share_token: string;
  is_active: boolean;
  created_at: string;
}

// Base62 alphabet for short, URL-safe tokens
const BASE62_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// Convert bytes to base62 string
function bytesToBase62(bytes: Uint8Array): string {
  let result = "";
  // Convert each byte to base62 (gives ~1.3 chars per byte)
  let num = 0n;
  for (const byte of bytes) {
    num = num * 256n + BigInt(byte);
  }
  while (num > 0n) {
    result = BASE62_CHARS[Number(num % 62n)] + result;
    num = num / 62n;
  }
  return result || "0";
}

// Генерация криптографически стойкого короткого токена
// 8 bytes = ~11 chars in base62 = 62^11 ≈ 52 trillion combinations
function generateShareToken(): string {
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  return bytesToBase62(array);
}

// Helper to check if ID is offline-generated
function isOfflineId(id: string): boolean {
  return id.startsWith("offline_");
}

// Получить активный share для тренировки
export function useWorkoutShare(workoutId: string | undefined) {
  const { isGuest } = useAuth();

  return useQuery({
    queryKey: ["workout-share", workoutId],
    queryFn: async () => {
      if (!workoutId || !navigator.onLine) return null;

      // Skip for offline IDs (they don't exist in Supabase)
      if (isOfflineId(workoutId)) return null;

      const { data, error } = await supabase
        .from("workout_shares")
        .select("*")
        .eq("workout_id", workoutId)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data as WorkoutShare | null;
    },
    // Disable for guests and offline IDs
    enabled: !!workoutId && !isGuest && !isOfflineId(workoutId || ""),
  });
}

// Создать или активировать share ссылку
export function useCreateWorkoutShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workoutId, userId }: { workoutId: string; userId: string }) => {
      // Сначала проверяем, есть ли уже активный share
      const { data: existingShare } = await supabase
        .from("workout_shares")
        .select("*")
        .eq("workout_id", workoutId)
        .eq("is_active", true)
        .maybeSingle();

      if (existingShare) {
        return existingShare as WorkoutShare;
      }

      // Создаём новый share
      const shareToken = generateShareToken();

      const { data, error } = await supabase
        .from("workout_shares")
        .insert({
          workout_id: workoutId,
          user_id: userId,
          share_token: shareToken,
          is_active: true,
        })
        .select()
        .single();

      // Handle race condition - if duplicate key error, fetch existing share
      if (error?.code === "23505") {
        const { data: raceShare } = await supabase
          .from("workout_shares")
          .select("*")
          .eq("workout_id", workoutId)
          .eq("is_active", true)
          .maybeSingle();

        if (raceShare) {
          return raceShare as WorkoutShare;
        }
      }

      if (error) throw error;
      return data as WorkoutShare;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["workout-share", variables.workoutId] });
    },
  });
}

// Деактивировать share ссылку
export function useDeactivateWorkoutShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shareId: string) => {
      // First check if already deactivated to avoid unnecessary calls
      const { data: existing } = await supabase
        .from("workout_shares")
        .select("is_active")
        .eq("id", shareId)
        .single();

      // Already deactivated, nothing to do
      if (existing && !existing.is_active) {
        return;
      }

      const { error } = await supabase
        .from("workout_shares")
        .update({ is_active: false })
        .eq("id", shareId);

      if (error) throw error;
    },
    onSuccess: () => {
      // Инвалидируем кэш для всех share запросов
      queryClient.invalidateQueries({ queryKey: ["workout-share"] });
    },
    // Don't retry on failure
    retry: false,
  });
}

// Получить тренировку по share токену (для публичного доступа)
export function useSharedWorkout(shareToken: string | undefined) {
  return useQuery({
    queryKey: ["shared-workout", shareToken],
    queryFn: async () => {
      if (!shareToken || !navigator.onLine) return null;

      // Сначала получаем share запись
      const { data: share, error: shareError } = await supabase
        .from("workout_shares")
        .select("*")
        .eq("share_token", shareToken)
        .eq("is_active", true)
        .maybeSingle();

      if (shareError) throw shareError;
      if (!share) return null;

      // Теперь получаем полную тренировку со всеми данными
      const { data: workout, error: workoutError } = await supabase
        .from("workouts")
        .select(`
          *,
          workout_sets (
            *,
            exercise:exercises (*)
          )
        `)
        .eq("id", share.workout_id)
        .single();

      if (workoutError) throw workoutError;

      return {
        ...workout,
        share,
      };
    },
    enabled: !!shareToken,
  });
}
