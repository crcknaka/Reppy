export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'legs' | 'core' | 'cardio' | 'fullbody' | 'other';

export const MUSCLE_GROUPS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'core', 'cardio', 'fullbody', 'other'];

export function getMuscleGroupLabel(group: string, t: (key: string) => string): string {
  return t(`muscleGroups.${group}`);
}

export function getMuscleGroupColor(group: string): string {
  switch (group) {
    case 'chest': return 'bg-red-500/15 text-red-500';
    case 'back': return 'bg-blue-500/15 text-blue-500';
    case 'shoulders': return 'bg-orange-500/15 text-orange-500';
    case 'biceps': return 'bg-purple-500/15 text-purple-500';
    case 'triceps': return 'bg-pink-500/15 text-pink-500';
    case 'legs': return 'bg-green-500/15 text-green-500';
    case 'core': return 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400';
    case 'cardio': return 'bg-cyan-500/15 text-cyan-500';
    case 'fullbody': return 'bg-primary/15 text-primary';
    default: return 'bg-muted text-muted-foreground';
  }
}
