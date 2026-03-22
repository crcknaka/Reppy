import type { Locale } from "date-fns";

import type { Exercise } from "@/hooks/useExercises";
import type { LastSetData, RecentSetData } from "@/offline";

export type AddSetPayload = {
  exerciseId: string;
  setNumber: number;
  reps?: number;
  weight?: number;
  distance_km?: number;
  duration_minutes?: number;
  plank_seconds?: number;
};

export type UpdateSetPayload = {
  setId: string;
  reps: number | null;
  weight: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  plank_seconds: number | null;
};

export type EditSetContext = {
  setId: string;
  exerciseId: string;
  reps: number | null;
  weight: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  plank_seconds: number | null;
};

export type UnitsConfig = {
  weight: string;
  distance: string;
};

export type SharedSetDialogDataProps = {
  dateLocale: Locale;
  effectiveUserId: string | null;
  autoFillEnabled: boolean;
  units: UnitsConfig;
  convertWeight: (value: number) => number;
  convertDistance: (value: number) => number;
  toMetricWeight: (value: number) => number;
  toMetricDistance: (value: number) => number;
  existingSetCountByExercise: Record<string, number>;
  totalSetCount: number;
  isSubmitting: boolean;
  onGetRecentSets: (exerciseId: string, userId: string, limit: number) => Promise<RecentSetData[]>;
  onGetLastSet: (exerciseId: string, userId: string) => Promise<LastSetData | null>;
  onAddSet: (payload: AddSetPayload) => Promise<void>;
  onUpdateSet: (payload: UpdateSetPayload) => Promise<void>;
};

export type ExerciseSelectionBaseProps = {
  exercises: Exercise[];
  favoriteExerciseIds: Set<string>;
  onToggleFavorite: (exerciseId: string, isFavorite: boolean) => Promise<void>;
};
