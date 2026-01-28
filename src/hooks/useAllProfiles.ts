import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserProfile {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar: string | null;
  is_admin: boolean;
}

export function useAllProfiles() {
  return useQuery({
    queryKey: ["profiles", "all"],
    queryFn: async () => {
      if (!navigator.onLine) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar, is_admin")
        .order("display_name", { ascending: true });

      if (error) throw error;
      return data as UserProfile[];
    },
    staleTime: 1000 * 60 * 30, // 30 minutes - all profiles list rarely changes
  });
}
