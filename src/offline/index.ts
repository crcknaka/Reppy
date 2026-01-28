// Database
export { offlineDb, generateOfflineId, isOfflineId, clearOfflineData, getLastWeightForExercise, getLastSetForExercise, getRecentSetsForExercise } from "./db";
export type { LastSetData, RecentSetData } from "./db";

// Types
export type * from "./types";

// Sync
export { syncQueue } from "./syncQueue";
export { syncService, syncWithRetry, type SyncResult } from "./syncService";

// Hooks
export { useOfflineStatus, type OfflineStatus } from "./hooks/useOfflineStatus";
export {
  useOfflineWorkouts,
  useOfflineSingleWorkout,
  useOfflineCreateWorkout,
  useOfflineAddSet,
  useOfflineUpdateSet,
  useOfflineDeleteSet,
  useOfflineDeleteWorkout,
  useOfflineUpdateWorkout,
} from "./hooks/useOfflineWorkouts";
export {
  useOfflineExercises,
  useOfflineCreateExercise,
  useOfflineDeleteExercise,
  useOfflineFavoriteExercises,
  useOfflineToggleFavoriteExercise,
} from "./hooks/useOfflineExercises";
export {
  useOfflineProfile,
  useOfflineUpdateProfile,
} from "./hooks/useOfflineProfile";

// Components
export {
  OfflineIndicator,
  SyncStatusBadge,
  UnsyncedIndicator,
} from "./components/OfflineIndicator";
