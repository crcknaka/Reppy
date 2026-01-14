import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the action and IDs from request body
    const { action, ids } = await req.json();
    if (!action) {
      return new Response(
        JSON.stringify({ error: "action is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client with user's auth to verify they are admin
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the requesting user from the JWT
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token or user not found" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the requesting user is an admin
    const { data: adminProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("user_id", user.id)
      .single();

    if (profileError || !adminProfile?.is_admin) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let deletedCount = 0;

    switch (action) {
      case "deleteEmptyWorkouts": {
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return new Response(
            JSON.stringify({ error: "ids array is required for deleteEmptyWorkouts" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Delete workouts in batches
        const batchSize = 100;
        for (let i = 0; i < ids.length; i += batchSize) {
          const batch = ids.slice(i, i + batchSize);
          const { error } = await supabaseAdmin
            .from("workouts")
            .delete()
            .in("id", batch);

          if (error) {
            console.error("Error deleting workouts:", error);
            throw error;
          }
        }
        deletedCount = ids.length;
        break;
      }

      case "deleteOrphanedSets": {
        // Get all workout IDs
        const { data: workouts } = await supabaseAdmin
          .from("workouts")
          .select("id");

        const validWorkoutIds = new Set(workouts?.map((w) => w.id) || []);

        // Get all workout sets (paginate)
        const orphanedIds: string[] = [];
        let offset = 0;
        const pageSize = 1000;

        while (true) {
          const { data: sets } = await supabaseAdmin
            .from("workout_sets")
            .select("id, workout_id")
            .range(offset, offset + pageSize - 1);

          if (!sets || sets.length === 0) break;

          sets.forEach((s) => {
            if (!validWorkoutIds.has(s.workout_id)) {
              orphanedIds.push(s.id);
            }
          });

          if (sets.length < pageSize) break;
          offset += pageSize;
        }

        if (orphanedIds.length > 0) {
          // Delete in batches
          const batchSize = 100;
          for (let i = 0; i < orphanedIds.length; i += batchSize) {
            const batch = orphanedIds.slice(i, i + batchSize);
            const { error } = await supabaseAdmin
              .from("workout_sets")
              .delete()
              .in("id", batch);

            if (error) {
              console.error("Error deleting orphaned sets:", error);
              throw error;
            }
          }
        }
        deletedCount = orphanedIds.length;
        break;
      }

      case "deleteUnusedExercises": {
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return new Response(
            JSON.stringify({ error: "ids array is required for deleteUnusedExercises" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Delete in batches
        const batchSize = 100;
        for (let i = 0; i < ids.length; i += batchSize) {
          const batch = ids.slice(i, i + batchSize);
          const { error } = await supabaseAdmin
            .from("exercises")
            .delete()
            .in("id", batch);

          if (error) {
            console.error("Error deleting exercises:", error);
            throw error;
          }
        }
        deletedCount = ids.length;
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, count: deletedCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in admin-cleanup function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
