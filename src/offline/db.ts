import Dexie, { type Table } from "dexie";
import type {
  OfflineWorkout,
  OfflineWorkoutSet,
  OfflineExercise,
  OfflineProfile,
  OfflineFavoriteExercise,
  SyncQueueItem,
  SyncMetadata,
  IdMapping,
} from "./types";

class ReppyOfflineDB extends Dexie {
  workouts!: Table<OfflineWorkout>;
  workoutSets!: Table<OfflineWorkoutSet>;
  exercises!: Table<OfflineExercise>;
  profiles!: Table<OfflineProfile>;
  favoriteExercises!: Table<OfflineFavoriteExercise>;
  syncQueue!: Table<SyncQueueItem>;
  metadata!: Table<SyncMetadata>;
  idMappings!: Table<IdMapping>;

  constructor() {
    super("ReppyOfflineDB");

    this.version(1).stores({
      workouts: "id, user_id, date, _synced, _lastModified",
      workoutSets: "id, workout_id, exercise_id, _synced, _lastModified",
      exercises: "id, user_id, is_preset, type, _synced",
      profiles: "user_id",
      favoriteExercises: "id, user_id, exercise_id, _synced",
      syncQueue: "++id, table, createdAt, entityId",
      metadata: "key",
    });

    // Version 2: Add idMappings table for offline->server ID persistence
    this.version(2).stores({
      workouts: "id, user_id, date, _synced, _lastModified",
      workoutSets: "id, workout_id, exercise_id, _synced, _lastModified",
      exercises: "id, user_id, is_preset, type, _synced",
      profiles: "user_id",
      favoriteExercises: "id, user_id, exercise_id, _synced",
      syncQueue: "++id, table, createdAt, entityId",
      metadata: "key",
      idMappings: "offlineId, serverId, table",
    });
  }
}

export const offlineDb = new ReppyOfflineDB();

// Helper to generate offline IDs
export function generateOfflineId(): string {
  return `offline_${crypto.randomUUID()}`;
}

// Check if an ID is an offline-generated ID
export function isOfflineId(id: string): boolean {
  return id.startsWith("offline_");
}

// Clear all offline data (useful for logout)
export async function clearOfflineData(): Promise<void> {
  await offlineDb.transaction(
    "rw",
    [
      offlineDb.workouts,
      offlineDb.workoutSets,
      offlineDb.exercises,
      offlineDb.profiles,
      offlineDb.favoriteExercises,
      offlineDb.syncQueue,
      offlineDb.metadata,
      offlineDb.idMappings,
    ],
    async () => {
      await offlineDb.workouts.clear();
      await offlineDb.workoutSets.clear();
      await offlineDb.exercises.clear();
      await offlineDb.profiles.clear();
      await offlineDb.favoriteExercises.clear();
      await offlineDb.syncQueue.clear();
      await offlineDb.metadata.clear();
      await offlineDb.idMappings.clear();
    }
  );
}

// Get last sync timestamp for a table
export async function getLastSyncTime(table: string): Promise<number | null> {
  const meta = await offlineDb.metadata.get(`lastSync_${table}`);
  return meta ? (meta.value as number) : null;
}

// Set last sync timestamp for a table
export async function setLastSyncTime(
  table: string,
  timestamp: number
): Promise<void> {
  await offlineDb.metadata.put({
    key: `lastSync_${table}`,
    value: timestamp,
  });
}

// Last set data for auto-fill (supports all exercise types)
export interface LastSetData {
  weight?: number;
  reps?: number;
  distance_km?: number;
  duration_minutes?: number;
  plank_seconds?: number;
}

// Get the last used set data for a specific exercise (for auto-fill)
export async function getLastSetForExercise(
  exerciseId: string,
  userId: string
): Promise<LastSetData | null> {
  try {
    // Get all sets for this exercise
    const sets = await offlineDb.workoutSets
      .where("exercise_id")
      .equals(exerciseId)
      .toArray();

    if (sets.length === 0) return null;

    // Filter sets that belong to user's workouts
    const userWorkouts = await offlineDb.workouts
      .where("user_id")
      .equals(userId)
      .toArray();
    const userWorkoutIds = new Set(userWorkouts.map((w) => w.id));

    const userSets = sets
      .filter((s) => userWorkoutIds.has(s.workout_id))
      .sort((a, b) => {
        // Sort by created_at descending (newest first)
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });

    if (userSets.length === 0) return null;

    const lastSet = userSets[0];
    return {
      weight: lastSet.weight || undefined,
      reps: lastSet.reps || undefined,
      distance_km: lastSet.distance_km || undefined,
      duration_minutes: lastSet.duration_minutes || undefined,
      plank_seconds: lastSet.plank_seconds || undefined,
    };
  } catch (error) {
    console.error("[getLastSetForExercise] Error:", error);
    return null;
  }
}

// Get recent sets for exercise history display
export interface RecentSetData {
  weight?: number;
  reps?: number;
  distance_km?: number;
  duration_minutes?: number;
  plank_seconds?: number;
  date: string;
  created_at: string;
}

export async function getRecentSetsForExercise(
  exerciseId: string,
  userId: string,
  limit: number = 3
): Promise<RecentSetData[]> {
  try {
    // Get all sets for this exercise
    const sets = await offlineDb.workoutSets
      .where("exercise_id")
      .equals(exerciseId)
      .toArray();

    if (sets.length === 0) return [];

    // Get user's workouts with dates
    const userWorkouts = await offlineDb.workouts
      .where("user_id")
      .equals(userId)
      .toArray();
    const workoutMap = new Map(userWorkouts.map((w) => [w.id, w.date]));

    const userSets = sets
      .filter((s) => workoutMap.has(s.workout_id))
      .map((s) => ({
        ...s,
        date: workoutMap.get(s.workout_id) || "",
      }))
      .sort((a, b) => {
        // Sort by created_at descending (newest first)
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, limit);

    return userSets.map((s) => ({
      weight: s.weight || undefined,
      reps: s.reps || undefined,
      distance_km: s.distance_km || undefined,
      duration_minutes: s.duration_minutes || undefined,
      plank_seconds: s.plank_seconds || undefined,
      date: s.date,
      created_at: s.created_at,
    }));
  } catch (error) {
    console.error("[getRecentSetsForExercise] Error:", error);
    return [];
  }
}

// Legacy alias for backward compatibility
export async function getLastWeightForExercise(
  exerciseId: string,
  userId: string
): Promise<{ weight: number; reps: number } | null> {
  const data = await getLastSetForExercise(exerciseId, userId);
  if (!data || !data.weight) return null;
  return { weight: data.weight, reps: data.reps || 0 };
}

// Debug function to check IndexedDB contents
export async function debugOfflineDb(): Promise<void> {
  try {
    const workoutsCount = await offlineDb.workouts.count();
    const setsCount = await offlineDb.workoutSets.count();
    const exercisesCount = await offlineDb.exercises.count();
    console.log("[Offline DB Debug] Workouts:", workoutsCount, "Sets:", setsCount, "Exercises:", exercisesCount);

    // Show first workout if any
    const firstWorkout = await offlineDb.workouts.toCollection().first();
    if (firstWorkout) {
      console.log("[Offline DB Debug] First workout:", firstWorkout);
    }
  } catch (error) {
    console.error("[Offline DB Debug] Error:", error);
  }
}
