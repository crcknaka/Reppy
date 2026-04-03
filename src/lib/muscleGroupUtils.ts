export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'legs' | 'core' | 'cardio' | 'fullbody' | 'other';

export const MUSCLE_GROUPS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'core', 'cardio', 'fullbody', 'other'];

export function getMuscleGroupLabel(group: string, t: (key: string) => string): string {
  return t(`muscleGroups.${group}`);
}

export function getMuscleGroupColor(_group: string): string {
  return 'bg-muted/70 text-muted-foreground';
}
