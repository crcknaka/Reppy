import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { offlineDb } from "../db";
import { syncQueue } from "../syncQueue";
import type { OfflineProfile } from "../types";
import type { Profile } from "@/hooks/useProfile";

// Offline-first profile hook
export function useOfflineProfile() {
  const { user, effectiveUserId, isGuest } = useAuth();

  return useQuery({
    queryKey: ["profile", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return null;

      // Always try cache first for instant display
      const cachedProfile = await offlineDb.profiles.get(effectiveUserId);

      // If online and not guest, try to refresh from server
      if (navigator.onLine && !isGuest) {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", effectiveUserId)
            .single();

          if (!error && data) {
            // Update cache
            const offlineProfile: OfflineProfile = {
              ...data,
              _synced: true,
              _lastModified: Date.now(),
            };
            await offlineDb.profiles.put(offlineProfile);
            return data as Profile;
          }
        } catch {
          // Network error - fall through to cached data
        }
      }

      // Return cached data
      if (cachedProfile) {
        const { _synced, _lastModified, ...profile } = cachedProfile;
        return profile as Profile;
      }

      // For guests, return a minimal profile
      if (isGuest) {
        return {
          user_id: effectiveUserId,
          display_name: null,
          current_weight: null,
          gender: null,
          date_of_birth: null,
          height: null,
          avatar: null,
          created_at: new Date().toISOString(),
        } as Profile;
      }

      return null;
    },
    enabled: !!effectiveUserId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

// Offline-first update profile mutation
export function useOfflineUpdateProfile() {
  const queryClient = useQueryClient();
  const { user, effectiveUserId, isGuest } = useAuth();

  return useMutation({
    mutationFn: async (profileData: Partial<Profile>) => {
      if (!effectiveUserId) throw new Error("User not authenticated");

      // Get current profile from cache
      const currentProfile = await offlineDb.profiles.get(effectiveUserId);

      // Use navigator.onLine directly for most accurate online status
      const online = navigator.onLine;

      const updatedProfile: OfflineProfile = {
        id: currentProfile?.id || effectiveUserId,
        user_id: effectiveUserId,
        display_name: currentProfile?.display_name || null,
        current_weight: currentProfile?.current_weight || null,
        gender: currentProfile?.gender || null,
        date_of_birth: currentProfile?.date_of_birth || null,
        height: currentProfile?.height || null,
        avatar: currentProfile?.avatar || null,
        is_admin: currentProfile?.is_admin || false,
        created_at: currentProfile?.created_at || new Date().toISOString(),
        ...profileData,
        _synced: false, // Will be set to true after successful sync
        _lastModified: Date.now(),
      };

      // Save to IndexedDB immediately (optimistic update)
      await offlineDb.profiles.put(updatedProfile);

      // If online and not guest, try to sync to server
      if (online && !isGuest) {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .update(profileData)
            .eq("user_id", effectiveUserId)
            .select()
            .single();

          if (!error && data) {
            // Update cache with server response
            const syncedProfile: OfflineProfile = {
              ...data,
              _synced: true,
              _lastModified: Date.now(),
            };
            await offlineDb.profiles.put(syncedProfile);
            return data as Profile;
          }
        } catch {
          // Network error - already saved locally, queue for sync
        }
      }

      // Queue for sync when back online (only for authenticated users)
      if (!isGuest) {
        await syncQueue.enqueue("profiles", "update", effectiveUserId, {
          ...profileData,
          user_id: effectiveUserId,
        });
      }

      // Return the updated profile from cache
      const { _synced, _lastModified, ...profile } = updatedProfile;
      return profile as Profile;
    },
    onSuccess: (data) => {
      // Update query cache directly instead of invalidating (prevents form reset)
      queryClient.setQueryData(["profile", data.user_id], data);
    },
  });
}
