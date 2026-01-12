import { supabase } from "@/integrations/supabase/client";
import { offlineDb, setLastSyncTime, isOfflineId } from "./db";
import { syncQueue } from "./syncQueue";
import type { SyncQueueItem, SyncTable, IdMapping } from "./types";

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000]; // Exponential backoff

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

class SyncService {
  private isSyncing = false;
  private idMappingsCache = new Map<string, string>(); // In-memory cache for performance
  private mappingsLoaded = false;

  // Load ID mappings from IndexedDB into memory cache
  private async loadMappings(): Promise<void> {
    if (this.mappingsLoaded) return;

    try {
      const mappings = await offlineDb.idMappings.toArray();
      for (const mapping of mappings) {
        this.idMappingsCache.set(mapping.offlineId, mapping.serverId);
      }
      this.mappingsLoaded = true;
    } catch (error) {
      console.error("Failed to load ID mappings:", error);
    }
  }

  // Save a single ID mapping to IndexedDB
  private async saveMapping(offlineId: string, serverId: string, table: SyncTable): Promise<void> {
    this.idMappingsCache.set(offlineId, serverId);

    try {
      await offlineDb.idMappings.put({
        offlineId,
        serverId,
        table,
        createdAt: Date.now(),
      });
    } catch (error) {
      console.error("Failed to save ID mapping:", error);
    }
  }

  // Get server ID for an offline ID (from cache or DB)
  private async getServerId(offlineId: string): Promise<string | undefined> {
    // Check cache first
    const cached = this.idMappingsCache.get(offlineId);
    if (cached) return cached;

    // Load from DB if not in cache
    try {
      const mapping = await offlineDb.idMappings.get(offlineId);
      if (mapping) {
        this.idMappingsCache.set(offlineId, mapping.serverId);
        return mapping.serverId;
      }
    } catch (error) {
      console.error("Failed to get ID mapping:", error);
    }

    return undefined;
  }

  // Start sync process
  async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { success: false, synced: 0, failed: 0, errors: ["Sync already in progress"] };
    }

    this.isSyncing = true;
    const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] };

    try {
      // Load ID mappings from IndexedDB before syncing
      await this.loadMappings();

      // Consolidate queue before syncing
      await syncQueue.consolidate();

      // Process items one by one
      let item = await syncQueue.getNext();
      while (item) {
        const itemResult = await this.syncItem(item);

        if (itemResult.success) {
          await syncQueue.markCompleted(item.id!);
          result.synced++;
        } else {
          await syncQueue.markFailed(item.id!, itemResult.error || "Unknown error");

          if (item.retryCount >= MAX_RETRIES - 1) {
            result.failed++;
            result.errors.push(`Failed to sync ${item.table} ${item.operation}: ${itemResult.error}`);
            await syncQueue.markCompleted(item.id!); // Remove after max retries
          }
        }

        item = await syncQueue.getNext();
      }

      // Update last sync time
      await setLastSyncTime("all", Date.now());

      result.success = result.failed === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : "Unknown sync error");
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  // Sync a single item
  private async syncItem(item: SyncQueueItem): Promise<{ success: boolean; error?: string }> {
    try {
      // Replace offline IDs with real IDs in data
      const data = await this.replaceOfflineIds(item.data);

      switch (item.table) {
        case "workouts":
          return await this.syncWorkout(item.operation, item.entityId, data);
        case "workout_sets":
          return await this.syncWorkoutSet(item.operation, item.entityId, data);
        case "exercises":
          return await this.syncExercise(item.operation, item.entityId, data);
        case "profiles":
          return await this.syncProfile(item.operation, item.entityId, data);
        case "favorite_exercises":
          return await this.syncFavoriteExercise(item.operation, item.entityId, data);
        default:
          return { success: false, error: `Unknown table: ${item.table}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  // Replace offline IDs with mapped real IDs
  private async replaceOfflineIds(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const result = { ...data };

    for (const [key, value] of Object.entries(result)) {
      if (typeof value === "string" && isOfflineId(value)) {
        const realId = await this.getServerId(value);
        if (realId) {
          result[key] = realId;
        }
      }
    }

    return result;
  }

  // Sync workout
  private async syncWorkout(
    operation: string,
    entityId: string,
    data: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    const { _synced, _lastModified, _offlineId, ...cleanData } = data as Record<string, unknown>;

    if (operation === "create") {
      const insertData = { ...cleanData };
      delete insertData.id; // Let server generate ID

      const { data: result, error } = await supabase
        .from("workouts")
        .insert(insertData)
        .select()
        .single();

      if (error) return { success: false, error: error.message };

      if (result) {
        // Map offline ID to real ID and persist to IndexedDB
        await this.saveMapping(entityId, result.id, "workouts");

        // Update local database with real ID
        await offlineDb.workouts.delete(entityId);
        await offlineDb.workouts.put({
          ...result,
          _synced: true,
          _lastModified: Date.now(),
        });

        // Update workout_sets that reference this workout
        const sets = await offlineDb.workoutSets
          .where("workout_id")
          .equals(entityId)
          .toArray();

        for (const set of sets) {
          await offlineDb.workoutSets.update(set.id, {
            workout_id: result.id,
          });
        }
      }

      return { success: true };
    }

    if (operation === "update") {
      const realId = (await this.getServerId(entityId)) || entityId;
      const { id, ...updateData } = cleanData;

      const { error } = await supabase
        .from("workouts")
        .update(updateData)
        .eq("id", realId);

      if (error) return { success: false, error: error.message };

      // Update local sync status
      await offlineDb.workouts.update(realId, { _synced: true });

      return { success: true };
    }

    if (operation === "delete") {
      const realId = (await this.getServerId(entityId)) || entityId;

      const { error } = await supabase
        .from("workouts")
        .delete()
        .eq("id", realId);

      if (error) return { success: false, error: error.message };

      // Delete from local database
      await offlineDb.workouts.delete(realId);

      return { success: true };
    }

    return { success: false, error: `Unknown operation: ${operation}` };
  }

  // Sync workout set
  private async syncWorkoutSet(
    operation: string,
    entityId: string,
    data: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    const { _synced, _lastModified, _offlineId, ...cleanData } = data as Record<string, unknown>;

    // Replace offline workout_id with real ID
    if (cleanData.workout_id && isOfflineId(cleanData.workout_id as string)) {
      const realWorkoutId = await this.getServerId(cleanData.workout_id as string);
      if (realWorkoutId) {
        cleanData.workout_id = realWorkoutId;
      } else {
        // Workout not yet synced - skip this set for now, it will retry
        return {
          success: false,
          error: "Waiting for workout to sync first",
        };
      }
    }

    if (operation === "create") {
      const insertData = { ...cleanData };
      delete insertData.id;

      const { data: result, error } = await supabase
        .from("workout_sets")
        .insert(insertData)
        .select()
        .single();

      if (error) return { success: false, error: error.message };

      if (result) {
        await this.saveMapping(entityId, result.id, "workout_sets");
        await offlineDb.workoutSets.delete(entityId);
        await offlineDb.workoutSets.put({
          ...result,
          _synced: true,
          _lastModified: Date.now(),
        });
      }

      return { success: true };
    }

    if (operation === "update") {
      const realId = (await this.getServerId(entityId)) || entityId;
      const { id, ...updateData } = cleanData;

      const { error } = await supabase
        .from("workout_sets")
        .update(updateData)
        .eq("id", realId);

      if (error) return { success: false, error: error.message };

      await offlineDb.workoutSets.update(realId, { _synced: true });

      return { success: true };
    }

    if (operation === "delete") {
      const realId = (await this.getServerId(entityId)) || entityId;

      const { error } = await supabase
        .from("workout_sets")
        .delete()
        .eq("id", realId);

      if (error) return { success: false, error: error.message };

      await offlineDb.workoutSets.delete(realId);

      return { success: true };
    }

    return { success: false, error: `Unknown operation: ${operation}` };
  }

  // Sync exercise
  private async syncExercise(
    operation: string,
    entityId: string,
    data: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    const { _synced, ...cleanData } = data as Record<string, unknown>;

    if (operation === "create") {
      const insertData = { ...cleanData };
      delete insertData.id;

      const { data: result, error } = await supabase
        .from("exercises")
        .insert(insertData)
        .select()
        .single();

      if (error) return { success: false, error: error.message };

      if (result) {
        await this.saveMapping(entityId, result.id, "exercises");
        await offlineDb.exercises.delete(entityId);
        await offlineDb.exercises.put({
          ...result,
          name_translations: (result as any).name_translations ?? null,
          _synced: true,
        });
      }

      return { success: true };
    }

    if (operation === "delete") {
      const realId = (await this.getServerId(entityId)) || entityId;

      const { error } = await supabase
        .from("exercises")
        .delete()
        .eq("id", realId);

      if (error) return { success: false, error: error.message };

      await offlineDb.exercises.delete(realId);

      return { success: true };
    }

    return { success: false, error: `Unknown operation: ${operation}` };
  }

  // Sync profile
  private async syncProfile(
    operation: string,
    entityId: string,
    data: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    const { _synced, _lastModified, ...cleanData } = data as Record<string, unknown>;

    if (operation === "update") {
      const { id, user_id, created_at, ...updateData } = cleanData;

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("user_id", entityId);

      if (error) return { success: false, error: error.message };

      const profile = await offlineDb.profiles.get(entityId);
      if (profile) {
        await offlineDb.profiles.update(entityId, { _synced: true });
      }

      return { success: true };
    }

    return { success: false, error: `Unknown operation: ${operation}` };
  }

  // Sync favorite exercise
  private async syncFavoriteExercise(
    operation: string,
    entityId: string,
    data: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    const { _synced, ...cleanData } = data as Record<string, unknown>;

    if (operation === "create") {
      const insertData = { ...cleanData };
      delete insertData.id;

      const { data: result, error } = await supabase
        .from("favorite_exercises")
        .insert(insertData)
        .select()
        .single();

      if (error) return { success: false, error: error.message };

      if (result) {
        await this.saveMapping(entityId, result.id, "favorite_exercises");
        await offlineDb.favoriteExercises.delete(entityId);
        await offlineDb.favoriteExercises.put({
          ...result,
          _synced: true,
        });
      }

      return { success: true };
    }

    if (operation === "delete") {
      const realId = (await this.getServerId(entityId)) || entityId;

      const { error } = await supabase
        .from("favorite_exercises")
        .delete()
        .eq("id", realId);

      if (error) return { success: false, error: error.message };

      await offlineDb.favoriteExercises.delete(realId);

      return { success: true };
    }

    return { success: false, error: `Unknown operation: ${operation}` };
  }

  // Check if sync is in progress
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  // Clear ID mappings (call on logout)
  async clearMappings(): Promise<void> {
    this.idMappingsCache.clear();
    this.mappingsLoaded = false;
    try {
      await offlineDb.idMappings.clear();
    } catch (error) {
      console.error("Failed to clear ID mappings:", error);
    }
  }
}

export const syncService = new SyncService();

// Helper to retry sync with delay
export async function syncWithRetry(
  maxRetries: number = MAX_RETRIES
): Promise<SyncResult> {
  let lastResult: SyncResult = { success: false, synced: 0, failed: 0, errors: [] };

  for (let i = 0; i < maxRetries; i++) {
    lastResult = await syncService.sync();

    if (lastResult.success || lastResult.failed === 0) {
      return lastResult;
    }

    // Wait before retry
    if (i < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[i] || 15000));
    }
  }

  return lastResult;
}
