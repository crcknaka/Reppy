import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AppLog {
  id: string;
  user_id: string | null;
  level: "error" | "warn" | "info";
  message: string;
  stack: string | null;
  url: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  // Joined profile data
  profile?: {
    display_name: string | null;
    username: string | null;
    avatar: string | null;
  } | null;
}

export interface LogFilters {
  level?: "error" | "warn" | "info" | "all";
  userId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface LogStats {
  total: number;
  errors: number;
  warnings: number;
  info: number;
  todayCount: number;
}

export function useAppLogs(filters: LogFilters = {}, page = 1, pageSize = 50) {
  return useQuery({
    queryKey: ["appLogs", filters, page, pageSize],
    queryFn: async () => {
      if (!navigator.onLine) return { logs: [], total: 0 };

      let query = supabase
        .from("app_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      // Apply filters
      if (filters.level && filters.level !== "all") {
        query = query.eq("level", filters.level);
      }

      if (filters.userId) {
        query = query.eq("user_id", filters.userId);
      }

      if (filters.search) {
        query = query.or(`message.ilike.%${filters.search}%,url.ilike.%${filters.search}%`);
      }

      if (filters.dateFrom) {
        query = query.gte("created_at", filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte("created_at", filters.dateTo + "T23:59:59");
      }

      const { data, error, count } = await query;

      if (error) throw error;

      // Fetch user profiles for logs with user_id
      const userIds = [...new Set(data?.filter(log => log.user_id).map(log => log.user_id) || [])];

      let profiles: Record<string, { display_name: string | null; username: string | null; avatar: string | null }> = {};

      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar")
          .in("user_id", userIds);

        if (profileData) {
          profiles = Object.fromEntries(
            profileData.map(p => [p.user_id, { display_name: p.display_name, username: p.username, avatar: p.avatar }])
          );
        }
      }

      // Attach profiles to logs
      const logsWithProfiles: AppLog[] = (data || []).map(log => ({
        ...log,
        profile: log.user_id ? profiles[log.user_id] || null : null,
      }));

      return {
        logs: logsWithProfiles,
        total: count || 0,
      };
    },
    staleTime: 30000, // 30 seconds
  });
}

export function useLogStats() {
  return useQuery({
    queryKey: ["appLogs", "stats"],
    queryFn: async () => {
      if (!navigator.onLine) return null;

      const today = new Date().toISOString().split("T")[0];

      // Get counts by level
      const [totalResult, errorsResult, warningsResult, infoResult, todayResult] = await Promise.all([
        supabase.from("app_logs").select("*", { count: "exact", head: true }),
        supabase.from("app_logs").select("*", { count: "exact", head: true }).eq("level", "error"),
        supabase.from("app_logs").select("*", { count: "exact", head: true }).eq("level", "warn"),
        supabase.from("app_logs").select("*", { count: "exact", head: true }).eq("level", "info"),
        supabase.from("app_logs").select("*", { count: "exact", head: true }).gte("created_at", today),
      ]);

      return {
        total: totalResult.count || 0,
        errors: errorsResult.count || 0,
        warnings: warningsResult.count || 0,
        info: infoResult.count || 0,
        todayCount: todayResult.count || 0,
      } as LogStats;
    },
    staleTime: 60000, // 1 minute
  });
}

export function useDeleteLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase
        .from("app_logs")
        .delete()
        .eq("id", logId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appLogs"] });
    },
  });
}

export function useClearOldLogs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (daysOld = 30) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { error, count } = await supabase
        .from("app_logs")
        .delete()
        .lt("created_at", cutoffDate.toISOString())
        .select("*", { count: "exact", head: true });

      if (error) throw error;
      return count || 0;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appLogs"] });
    },
  });
}

export function useClearAllLogs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("app_logs")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appLogs"] });
    },
  });
}
