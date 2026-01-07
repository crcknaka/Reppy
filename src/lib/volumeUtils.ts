import { Tables } from "@/integrations/supabase/types";

type WorkoutSet = Tables<"workout_sets"> & {
  exercise?: Tables<"exercises"> | null;
};

/**
 * Calculate volume for a workout set
 * For bodyweight exercises without weight, uses user's body weight
 * For weighted exercises, uses the recorded weight
 */
export function calculateSetVolume(
  set: WorkoutSet,
  userBodyWeight?: number | null
): number {
  const exercise = set.exercise;
  
  // If weight is recorded, use it
  if (set.weight) {
    return set.reps * set.weight;
  }
  
  // If it's a bodyweight exercise and user has body weight recorded
  if (exercise?.type === 'bodyweight' && userBodyWeight) {
    return set.reps * userBodyWeight;
  }
  
  // Otherwise, volume is just reps (for bodyweight exercises without user weight)
  return exercise?.type === 'bodyweight' ? set.reps : 0;
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

