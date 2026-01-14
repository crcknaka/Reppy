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

// Генерация криптографически стойкого токена
function generateShareToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
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
      const { error } = await supabase
        .from("workout_shares")
        .update({ is_active: false })
        .eq("id", shareId);

      if (error) throw error;
    },
    onSuccess: (_, shareId) => {
      // Инвалидируем кэш для всех share запросов
      queryClient.invalidateQueries({ queryKey: ["workout-share"] });
    },
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
