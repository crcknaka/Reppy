import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { offlineDb, clearOfflineData, setLastSyncTime } from "@/offline/db";
import { syncService, syncWithRetry, type SyncResult } from "@/offline/syncService";
import { syncQueue } from "@/offline/syncQueue";
import { useOfflineStatus } from "@/offline/hooks/useOfflineStatus";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface OfflineContextType {
  isOnline: boolean;
  isInitialized: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
  triggerSync: () => Promise<SyncResult>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isOnline, pendingCount, lastSyncTime, checkConnection } = useOfflineStatus();

  // Always true - IndexedDB is always "ready", just may be empty
  const isInitialized = true;
  const [isSyncing, setIsSyncing] = useState(false);
  const wasOfflineRef = useRef(false);
  const hasHydratedRef = useRef(false);

  // Hydrate IndexedDB from Supabase on first load
  const hydrateFromServer = useCallback(async () => {
    if (!user || hasHydratedRef.current) return;

    try {
      // Fetch exercises (all exercises, preset and user's custom)
      const { data: exercises } = await supabase
        .from("exercises")
        .select("*")
        .or(`is_preset.eq.true,user_id.eq.${user.id}`);

      if (exercises) {
        await offlineDb.exercises.bulkPut(
          exercises.map((e) => ({
            ...e,
            name_translations: null, // Will be populated from locales
            _synced: true,
          }))
        );
      }

      // Fetch user's workouts (last 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const dateStr = ninetyDaysAgo.toISOString().split("T")[0];

      const { data: workouts } = await supabase
        .from("workouts")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", dateStr);

      if (workouts) {
        await offlineDb.workouts.bulkPut(
          workouts.map((w) => ({
            ...w,
            _synced: true,
            _lastModified: Date.now(),
          }))
        );

        // Fetch workout sets for these workouts
        const workoutIds = workouts.map((w) => w.id);
        if (workoutIds.length > 0) {
          const { data: sets } = await supabase
            .from("workout_sets")
            .select("*")
            .in("workout_id", workoutIds);

          if (sets) {
            await offlineDb.workoutSets.bulkPut(
              sets.map((s) => ({
                ...s,
                _synced: true,
                _lastModified: Date.now(),
              }))
            );
          }
        }
      }

      // Fetch user's profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        await offlineDb.profiles.put({
          ...profile,
          _synced: true,
          _lastModified: Date.now(),
        });
      }

      // Fetch favorite exercises
      const { data: favorites } = await supabase
        .from("favorite_exercises")
        .select("*")
        .eq("user_id", user.id);

      if (favorites) {
        await offlineDb.favoriteExercises.bulkPut(
          favorites.map((f) => ({
            ...f,
            _synced: true,
          }))
        );
      }

      // Precache exercise images for offline use
      if (exercises) {
        const imageUrls = exercises
          .filter((e) => e.image_url)
          .map((e) => e.image_url as string);

        if (imageUrls.length > 0) {
          // Trigger fetch for each image to populate service worker cache
          await Promise.allSettled(
            imageUrls.map((url) =>
              fetch(url, { mode: "no-cors" }).catch(() => {
                // Ignore errors - some images may not be accessible
              })
            )
          );
        }
      }

      // Precache workout photos
      if (workouts) {
        const photoUrls = workouts
          .filter((w) => w.photo_url)
          .map((w) => w.photo_url as string);

        if (photoUrls.length > 0) {
          await Promise.allSettled(
            photoUrls.map((url) =>
              fetch(url, { mode: "no-cors" }).catch(() => {
                // Ignore errors
              })
            )
          );
        }
      }

      await setLastSyncTime("all", Date.now());
      hasHydratedRef.current = true;
    } catch (error) {
      console.error("Failed to hydrate offline data:", error);
    }
  }, [user]);

  // Initialize offline storage - hydrate from server if needed
  useEffect(() => {
    const init = async () => {
      if (!user) {
        hasHydratedRef.current = false;
        return;
      }

      try {
        // Check if we have data and need to hydrate
        const workoutCount = await offlineDb.workouts.count();

        if (workoutCount === 0 && isOnline) {
          // First time - hydrate from server
          await hydrateFromServer();
        }
      } catch (error) {
        console.error("Failed to initialize offline storage:", error);
      }
    };

    init();
  }, [user, isOnline, hydrateFromServer]);

  // Sync when coming back online
  useEffect(() => {
    if (!isInitialized || !user) return;

    if (!isOnline) {
      wasOfflineRef.current = true;
      return;
    }

    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;

      // Trigger sync after coming back online
      syncQueue.hasPending().then((hasPending) => {
        if (hasPending) {
          toast.info(t("offline.syncing"));
          triggerSync();
        }
      });
    }
  }, [isOnline, isInitialized, user, t]);

  // Auto-sync when pending count increases and we're online
  useEffect(() => {
    if (!isOnline || !isInitialized || isSyncing || pendingCount === 0) return;

    // Debounce sync to batch rapid changes
    const timeout = setTimeout(() => {
      triggerSync();
    }, 2000);

    return () => clearTimeout(timeout);
  }, [pendingCount, isOnline, isInitialized, isSyncing]);

  // Trigger sync manually
  const triggerSync = useCallback(async (): Promise<SyncResult> => {
    if (isSyncing || !isOnline) {
      return { success: false, synced: 0, failed: 0, errors: ["Cannot sync now"] };
    }

    setIsSyncing(true);

    try {
      const result = await syncWithRetry();

      if (result.synced > 0) {
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ["workouts"] });
        queryClient.invalidateQueries({ queryKey: ["exercises"] });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        queryClient.invalidateQueries({ queryKey: ["favoriteExercises"] });
      }

      if (result.success && result.synced > 0) {
        toast.success(t("offline.syncComplete"));
      } else if (result.failed > 0) {
        toast.error(t("offline.syncError"));
      }

      return result;
    } catch (error) {
      console.error("Sync failed:", error);
      toast.error(t("offline.syncError"));
      return { success: false, synced: 0, failed: 0, errors: [String(error)] };
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline, queryClient, t]);

  // Clear offline data on logout
  useEffect(() => {
    if (!user) {
      clearOfflineData().catch(console.error);
      syncService.clearMappings().catch(console.error);
    }
  }, [user]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isInitialized,
        isSyncing,
        pendingCount,
        lastSyncTime,
        triggerSync,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline(): OfflineContextType {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error("useOffline must be used within an OfflineProvider");
  }
  return context;
}
