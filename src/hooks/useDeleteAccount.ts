import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { clearOfflineData } from "@/offline/db";

export function useDeleteAccount() {
  const { user, signOut } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");

      // Get the current session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      // Call the Edge Function to delete the account
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete account");
      }

      // Clear local offline data
      await clearOfflineData();

      // Sign out locally (the auth user is already deleted on server)
      await signOut();

      return result;
    },
  });
}
