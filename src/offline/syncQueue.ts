import { offlineDb } from "./db";
import type { SyncQueueItem, SyncTable, SyncOperation } from "./types";

export class SyncQueue {
  // Add a new item to the sync queue
  async enqueue(
    table: SyncTable,
    operation: SyncOperation,
    entityId: string,
    data: Record<string, unknown>
  ): Promise<number> {
    return await offlineDb.syncQueue.add({
      table,
      operation,
      entityId,
      data,
      createdAt: Date.now(),
      retryCount: 0,
    });
  }

  // Get the next item to sync (workouts first, then other tables, oldest first)
  async getNext(): Promise<SyncQueueItem | undefined> {
    // Priority: sync workouts before workout_sets to ensure IDs are mapped
    const items = await offlineDb.syncQueue.orderBy("createdAt").toArray();

    // First, try to find a workout create operation
    const workoutCreate = items.find(
      (item) => item.table === "workouts" && item.operation === "create"
    );
    if (workoutCreate) return workoutCreate;

    // Then, try to find any other workout operation
    const workoutOther = items.find((item) => item.table === "workouts");
    if (workoutOther) return workoutOther;

    // Finally, return the oldest item
    return items[0];
  }

  // Get all pending items
  async getAll(): Promise<SyncQueueItem[]> {
    return await offlineDb.syncQueue.orderBy("createdAt").toArray();
  }

  // Get pending items for a specific table
  async getByTable(table: SyncTable): Promise<SyncQueueItem[]> {
    return await offlineDb.syncQueue
      .where("table")
      .equals(table)
      .sortBy("createdAt");
  }

  // Get pending items for a specific entity
  async getByEntity(entityId: string): Promise<SyncQueueItem[]> {
    return await offlineDb.syncQueue
      .where("entityId")
      .equals(entityId)
      .toArray();
  }

  // Mark an item as completed (remove from queue)
  async markCompleted(id: number): Promise<void> {
    await offlineDb.syncQueue.delete(id);
  }

  // Mark an item as failed (increment retry count)
  async markFailed(id: number, error: string): Promise<void> {
    const item = await offlineDb.syncQueue.get(id);
    if (item) {
      await offlineDb.syncQueue.update(id, {
        retryCount: item.retryCount + 1,
        lastError: error,
      });
    }
  }

  // Get count of pending items
  async getPendingCount(): Promise<number> {
    return await offlineDb.syncQueue.count();
  }

  // Check if there are any pending items
  async hasPending(): Promise<boolean> {
    const count = await this.getPendingCount();
    return count > 0;
  }

  // Remove all items for a specific entity (useful when entity is deleted)
  async removeByEntity(entityId: string): Promise<void> {
    await offlineDb.syncQueue.where("entityId").equals(entityId).delete();
  }

  // Remove stale items (too many retries)
  async removeStale(maxRetries: number = 5): Promise<number> {
    const staleItems = await offlineDb.syncQueue
      .filter((item) => item.retryCount >= maxRetries)
      .toArray();

    for (const item of staleItems) {
      if (item.id !== undefined) {
        await offlineDb.syncQueue.delete(item.id);
      }
    }

    return staleItems.length;
  }

  // Clear entire queue (use with caution)
  async clear(): Promise<void> {
    await offlineDb.syncQueue.clear();
  }

  // Consolidate operations for the same entity
  // (e.g., multiple updates become one, create+delete cancels out)
  async consolidate(): Promise<void> {
    const items = await this.getAll();
    const byEntity = new Map<string, SyncQueueItem[]>();

    // Group by entity
    for (const item of items) {
      const key = `${item.table}:${item.entityId}`;
      if (!byEntity.has(key)) {
        byEntity.set(key, []);
      }
      byEntity.get(key)!.push(item);
    }

    // Consolidate each group
    for (const [, entityItems] of byEntity) {
      if (entityItems.length <= 1) continue;

      // Sort by creation time
      entityItems.sort((a, b) => a.createdAt - b.createdAt);

      const first = entityItems[0];
      const last = entityItems[entityItems.length - 1];

      // If created and then deleted, remove all
      if (first.operation === "create" && last.operation === "delete") {
        for (const item of entityItems) {
          if (item.id !== undefined) {
            await offlineDb.syncQueue.delete(item.id);
          }
        }
        continue;
      }

      // Keep only the last operation with merged data
      const mergedData = entityItems.reduce(
        (acc, item) => ({ ...acc, ...item.data }),
        {} as Record<string, unknown>
      );

      // Delete all but keep track of first operation type if it was create
      const finalOperation =
        first.operation === "create" ? "create" : last.operation;

      for (let i = 0; i < entityItems.length - 1; i++) {
        const item = entityItems[i];
        if (item.id !== undefined) {
          await offlineDb.syncQueue.delete(item.id);
        }
      }

      // Update the last item with merged data and correct operation
      if (last.id !== undefined) {
        await offlineDb.syncQueue.update(last.id, {
          operation: finalOperation,
          data: mergedData,
        });
      }
    }
  }
}

export const syncQueue = new SyncQueue();
