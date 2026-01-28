import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface FriendProfile {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar: string | null;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  updated_at: string;
}

export interface FriendshipWithProfile extends Friendship {
  friend: FriendProfile;
}

export interface FriendRequest extends Friendship {
  requester: FriendProfile;
}

export interface SentRequest extends Friendship {
  addressee: FriendProfile;
}

// Get list of accepted friends
export function useFriends() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["friends", user?.id],
    queryFn: async () => {
      if (!user || !navigator.onLine) return [];

      // Get friendships where current user is either requester or addressee
      const { data: friendships, error } = await supabase
        .from("friendships")
        .select("*")
        .eq("status", "accepted")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      if (error) throw error;
      if (!friendships || friendships.length === 0) return [];

      // Get friend IDs (the other person in each friendship)
      const friendIds = friendships.map((f) =>
        f.requester_id === user.id ? f.addressee_id : f.requester_id
      );

      // Fetch profiles of friends
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar")
        .in("user_id", friendIds);

      if (profileError) throw profileError;

      // Combine friendship data with profiles
      return friendships.map((friendship) => {
        const friendId =
          friendship.requester_id === user.id
            ? friendship.addressee_id
            : friendship.requester_id;
        const profile = profiles?.find((p) => p.user_id === friendId);
        return {
          ...friendship,
          friend: profile || { user_id: friendId, display_name: null, username: null, avatar: null },
        } as FriendshipWithProfile;
      });
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 15, // 15 minutes - friends list rarely changes
  });
}

// Get incoming friend requests (pending)
export function usePendingFriendRequests() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["friendRequests", "pending", user?.id],
    queryFn: async () => {
      if (!user || !navigator.onLine) return [];

      const { data: requests, error } = await supabase
        .from("friendships")
        .select("*")
        .eq("addressee_id", user.id)
        .eq("status", "pending");

      if (error) throw error;
      if (!requests || requests.length === 0) return [];

      // Get requester profiles
      const requesterIds = requests.map((r) => r.requester_id);
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar")
        .in("user_id", requesterIds);

      if (profileError) throw profileError;

      return requests.map((request) => {
        const profile = profiles?.find((p) => p.user_id === request.requester_id);
        return {
          ...request,
          requester: profile || {
            user_id: request.requester_id,
            display_name: null,
            username: null,
            avatar: null,
          },
        } as FriendRequest;
      });
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes - pending requests should update relatively quickly
  });
}

// Get outgoing friend requests (sent by me, pending)
export function useSentFriendRequests() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["friendRequests", "sent", user?.id],
    queryFn: async () => {
      if (!user || !navigator.onLine) return [];

      const { data: requests, error } = await supabase
        .from("friendships")
        .select("*")
        .eq("requester_id", user.id)
        .eq("status", "pending");

      if (error) throw error;
      if (!requests || requests.length === 0) return [];

      // Get addressee profiles
      const addresseeIds = requests.map((r) => r.addressee_id);
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar")
        .in("user_id", addresseeIds);

      if (profileError) throw profileError;

      return requests.map((request) => {
        const profile = profiles?.find((p) => p.user_id === request.addressee_id);
        return {
          ...request,
          addressee: profile || {
            user_id: request.addressee_id,
            display_name: null,
            username: null,
            avatar: null,
          },
        } as SentRequest;
      });
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes - sent requests should update relatively quickly
  });
}

// Search users by display name or username
export function useSearchUsers(query: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["searchUsers", query],
    queryFn: async () => {
      if (!user || !query || query.length < 2 || !navigator.onLine) return [];

      // Search by display_name OR username
      const searchQuery = query.startsWith("@") ? query.slice(1) : query;
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar")
        .neq("user_id", user.id)
        .or(`display_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      return data as FriendProfile[];
    },
    enabled: !!user && query.length >= 2,
  });
}

// Send friend request
export function useSendFriendRequest() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (addresseeId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("friendships")
        .insert({
          requester_id: user.id,
          addressee_id: addresseeId,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendRequests", "sent"] });
      queryClient.invalidateQueries({ queryKey: ["searchUsers"] });
    },
  });
}

// Accept friend request
export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (friendshipId: string) => {
      const { data, error } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", friendshipId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["friendRequests", "pending"] });
    },
  });
}

// Reject friend request
export function useRejectFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (friendshipId: string) => {
      const { data, error } = await supabase
        .from("friendships")
        .update({ status: "rejected" })
        .eq("id", friendshipId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendRequests", "pending"] });
    },
  });
}

// Remove friend (delete friendship)
export function useRemoveFriend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase
        .from("friendships")
        .delete()
        .eq("id", friendshipId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });
}

// Cancel sent friend request
export function useCancelFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase
        .from("friendships")
        .delete()
        .eq("id", friendshipId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendRequests", "sent"] });
    },
  });
}

// Check friendship status with a specific user
export function useFriendshipStatus(targetUserId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["friendshipStatus", user?.id, targetUserId],
    queryFn: async () => {
      if (!user || !targetUserId || !navigator.onLine) return null;

      const { data, error } = await supabase
        .from("friendships")
        .select("*")
        .or(
          `and(requester_id.eq.${user.id},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${user.id})`
        )
        .maybeSingle();

      if (error) throw error;
      return data as Friendship | null;
    },
    enabled: !!user && !!targetUserId && targetUserId !== user.id,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Get count of pending friend requests (for badge)
export function usePendingRequestsCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["friendRequests", "count", user?.id],
    queryFn: async () => {
      if (!user || !navigator.onLine) return 0;

      const { count, error } = await supabase
        .from("friendships")
        .select("*", { count: "exact", head: true })
        .eq("addressee_id", user.id)
        .eq("status", "pending");

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes - badge count should update relatively quickly
  });
}
