import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useFavoriteExercises() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["favorite-exercises", user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("favorite_exercises")
        .select("exercise_id")
        .eq("user_id", user.id);

      if (error) throw error;

      // Return as Set for O(1) lookup
      return new Set(data.map(f => f.exercise_id));
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 15, // 15 minutes - favorites change infrequently
  });
}

export function useToggleFavoriteExercise() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ exerciseId, isFavorite }: { exerciseId: string; isFavorite: boolean }) => {
      if (!user?.id) throw new Error("User not authenticated");

      if (isFavorite) {
        // Remove from favorites
        const { error } = await supabase
          .from("favorite_exercises")
          .delete()
          .eq("exercise_id", exerciseId)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        // Add to favorites
        const { error } = await supabase
          .from("favorite_exercises")
          .insert({
            exercise_id: exerciseId,
            user_id: user.id,
          });

        if (error) throw error;
      }
    },
    // Optimistic update for instant UI feedback
    onMutate: async ({ exerciseId, isFavorite }) => {
      await queryClient.cancelQueries({ queryKey: ["favorite-exercises", user?.id] });

      const previousFavorites = queryClient.getQueryData<Set<string>>(["favorite-exercises", user?.id]);

      // Update the cache optimistically
      queryClient.setQueryData<Set<string>>(["favorite-exercises", user?.id], (old) => {
        const newSet = new Set(old);
        if (isFavorite) {
          newSet.delete(exerciseId);
        } else {
          newSet.add(exerciseId);
        }
        return newSet;
      });

      return { previousFavorites };
    },
    // If mutation fails, rollback
    onError: (err, variables, context) => {
      if (context?.previousFavorites) {
        queryClient.setQueryData(["favorite-exercises", user?.id], context.previousFavorites);
      }
    },
    // After success, refetch to ensure sync
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["favorite-exercises", user?.id] });
    },
  });
}
