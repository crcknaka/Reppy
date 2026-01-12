import type { Database } from "@/integrations/supabase/types";

export type ExerciseType = Database["public"]["Enums"]["exercise_type"];

// Base types from Supabase
export type WorkoutRow = Database["public"]["Tables"]["workouts"]["Row"];
export type WorkoutSetRow = Database["public"]["Tables"]["workout_sets"]["Row"];
export type ExerciseRow = Database["public"]["Tables"]["exercises"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type FavoriteExerciseRow = Database["public"]["Tables"]["favorite_exercises"]["Row"];

// Offline-specific fields
export interface OfflineMetadata {
  _synced: boolean;
  _lastModified: number;
  _offlineId?: string;
}

// Offline versions of database types
export interface OfflineWorkout extends WorkoutRow, OfflineMetadata {}

export interface OfflineWorkoutSet extends WorkoutSetRow, OfflineMetadata {}

export interface OfflineExercise extends Omit<ExerciseRow, "name_translations"> {
  name_translations: Record<string, string> | null;
  _synced: boolean;
}

export interface OfflineProfile extends ProfileRow {
  is_admin: boolean; // Not in ProfileRow but used in app
  _synced: boolean;
  _lastModified: number;
}

export interface OfflineFavoriteExercise extends FavoriteExerciseRow {
  _synced: boolean;
}

// Sync queue types
export type SyncOperation = "create" | "update" | "delete";

export type SyncTable =
  | "workouts"
  | "workout_sets"
  | "exercises"
  | "profiles"
  | "favorite_exercises";

export interface SyncQueueItem {
  id?: number;
  table: SyncTable;
  operation: SyncOperation;
  entityId: string;
  data: Record<string, unknown>;
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

// Metadata for tracking sync state
export interface SyncMetadata {
  key: string;
  value: unknown;
}

// ID mapping for offline -> server ID persistence
export interface IdMapping {
  offlineId: string;
  serverId: string;
  table: SyncTable;
  createdAt: number;
}

// Workout with nested sets for display (matching existing app types)
export interface OfflineWorkoutWithSets extends OfflineWorkout {
  workout_sets: (OfflineWorkoutSet & {
    exercise: OfflineExercise | null;
  })[];
}
