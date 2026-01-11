import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ExerciseTranslations = {
  en?: string;
  es?: string;
  "pt-BR"?: string;
  de?: string;
  fr?: string;
  ru?: string;
};

export interface Exercise {
  id: string;
  name: string;
  type: "bodyweight" | "weighted" | "cardio" | "timed";
  is_preset: boolean;
  image_url: string | null;
  user_id: string | null;
  name_translations?: ExerciseTranslations | null;
}

export function useExercises() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["exercises", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .order("is_preset", { ascending: false })
        .order("name");

      if (error) throw error;
      return data as Exercise[];
    },
    enabled: !!user,
  });
}

export function useCreateExercise() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      name,
      type,
    }: {
      name: string;
      type: "bodyweight" | "weighted" | "cardio" | "timed";
    }) => {
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

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
    },
  });
}

export function useDeleteExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (exerciseId: string) => {
      const { error } = await supabase
        .from("exercises")
        .delete()
        .eq("id", exerciseId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
    },
  });
}
