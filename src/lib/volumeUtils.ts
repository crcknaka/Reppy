import { Tables } from "@/integrations/supabase/types";

type WorkoutSet = Tables<"workout_sets"> & {
  exercise?: Tables<"exercises"> | null;
};

/**
 * Calculate volume for a workout set
 * For weighted exercises only - bodyweight and cardio exercises don't count towards volume
 */
export function calculateSetVolume(
  set: WorkoutSet,
  userBodyWeight?: number | null
): number {
  const exercise = set.exercise;

  // Bodyweight and cardio exercises don't contribute to volume calculation
  if (exercise?.type === 'bodyweight' || exercise?.type === 'cardio') {
    return 0;
  }

  // For weighted exercises, use the recorded weight
  if (set.weight && set.reps) {
    return set.reps * set.weight;
  }

  // No volume if no weight recorded for weighted exercise
  return 0;
}

/**
 * Calculate total volume for multiple sets
 */
export function calculateTotalVolume(
  sets: WorkoutSet[],
  userBodyWeight?: number | null
): number {
  return sets.reduce((total, set) => {
    return total + calculateSetVolume(set, userBodyWeight);
  }, 0);
}

/**
 * Format volume for display
 */
export function formatVolume(volume: number, includeUnit = true): string {
  if (volume === 0) return "—";
  
  const formatted = volume.toLocaleString('ru-RU', {
    maximumFractionDigits: 0,
  });
  
  return includeUnit ? `${formatted} кг × повт.` : formatted;
}

