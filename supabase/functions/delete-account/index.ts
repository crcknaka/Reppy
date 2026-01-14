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

    // Create Supabase client with user's JWT to verify identity
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client with user's auth to get their ID
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the user from the JWT
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token or user not found" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Admin client with service role key to delete user
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Delete all user data first (in order respecting foreign key constraints)

    // 1. Delete workout shares
    await supabaseAdmin
      .from("workout_shares")
      .delete()
      .eq("user_id", userId);

    // 2. Delete favorite exercises
    await supabaseAdmin
      .from("favorite_exercises")
      .delete()
      .eq("user_id", userId);

    // 3. Get all workout IDs for this user
    const { data: workouts } = await supabaseAdmin
      .from("workouts")
      .select("id")
      .eq("user_id", userId);

    const workoutIds = workouts?.map(w => w.id) || [];

    // 4. Delete workout sets for user's workouts
    if (workoutIds.length > 0) {
      await supabaseAdmin
        .from("workout_sets")
        .delete()
        .in("workout_id", workoutIds);
    }

    // 5. Delete workouts
    await supabaseAdmin
      .from("workouts")
      .delete()
      .eq("user_id", userId);

    // 6. Delete user-created exercises
    await supabaseAdmin
      .from("exercises")
      .delete()
      .eq("user_id", userId);

    // 7. Delete friendships (where user is requester or addressee)
    await supabaseAdmin
      .from("friendships")
      .delete()
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    // 8. Delete body weight history
    await supabaseAdmin
      .from("body_weight_history")
      .delete()
      .eq("user_id", userId);

    // 9. Delete profile
    await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("user_id", userId);

    // 10. Delete user from auth.users using admin API
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Error deleting auth user:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to delete user account: " + deleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Account deleted successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in delete-account function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
