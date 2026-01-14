import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  getOrCreateGuestUserId,
  getGuestUserId,
  clearGuestData,
  isGuestUserId
} from "@/lib/guestUser";
import { offlineDb } from "@/offline/db";
import { syncQueue } from "@/offline/syncQueue";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isGuest: boolean;
  guestUserId: string | null;
  effectiveUserId: string | null;
  isEmailVerified: boolean;
  isMigrating: boolean; // True while guest data is being migrated
  // Migration dialog state
  showMigrationDialog: boolean;
  pendingMigrationWorkoutCount: number;
  confirmMigration: () => void;
  discardGuestData: () => void;
  signUp: (email: string, password: string, displayName?: string, username?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initialize user from cache for immediate offline access
function getCachedUser(): User | null {
  const cachedUserId = localStorage.getItem("reppy_user_id");
  const cachedEmail = localStorage.getItem("reppy_user_email");
  if (cachedUserId) {
    return { id: cachedUserId, email: cachedEmail } as User;
  }
  return null;
}

// Initialize guest state synchronously to prevent flash of auth screen
function getInitialGuestState(): { isGuest: boolean; guestUserId: string | null } {
  const cachedUserId = localStorage.getItem("reppy_user_id");
  const existingGuestId = getGuestUserId();

  // If we have a cached real user, don't start in guest mode
  if (cachedUserId && !isGuestUserId(cachedUserId)) {
    return { isGuest: false, guestUserId: null };
  }

  // If we have an existing guest ID, restore guest mode immediately
  if (existingGuestId) {
    return { isGuest: true, guestUserId: existingGuestId };
  }

  return { isGuest: false, guestUserId: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // Get initial guest state synchronously
  const initialGuestState = getInitialGuestState();

  // Start with cached user for immediate offline access
  const [user, setUser] = useState<User | null>(getCachedUser);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(initialGuestState.isGuest);
  const [guestUserId, setGuestUserId] = useState<string | null>(initialGuestState.guestUserId);
  const [isMigrating, setIsMigrating] = useState(false);

  // Migration dialog state
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [pendingMigrationWorkoutCount, setPendingMigrationWorkoutCount] = useState(0);
  const [pendingMigrationUserId, setPendingMigrationUserId] = useState<string | null>(null);
  const [pendingMigrationGuestId, setPendingMigrationGuestId] = useState<string | null>(null);

  // Refs to keep track of guest state for migration (avoids stale closure issues)
  // Initialize with initial values to avoid stale closure issues
  const guestUserIdRef = useRef<string | null>(initialGuestState.guestUserId);
  const isGuestRef = useRef<boolean>(initialGuestState.isGuest);
  const migrationInProgressRef = useRef<boolean>(false);

  // Keep refs in sync with state
  useEffect(() => {
    guestUserIdRef.current = guestUserId;
    isGuestRef.current = isGuest;
  }, [guestUserId, isGuest]);

  // Compute effective user ID (real user or guest)
  const effectiveUserId = user?.id || guestUserId;

  // Initialize guest mode
  const initGuestMode = useCallback(() => {
    const guestId = getOrCreateGuestUserId();
    setGuestUserId(guestId);
    setIsGuest(true);
    setUser(null);
    setSession(null);
    // Also update refs immediately for migration callback
    guestUserIdRef.current = guestId;
    isGuestRef.current = true;
  }, []);

  // Migrate guest data to authenticated user
  const migrateGuestData = useCallback(async (newUserId: string, oldGuestId: string) => {
    // Prevent double migration
    if (migrationInProgressRef.current) {
      console.log("[Auth] Migration already in progress, skipping");
      return;
    }
    migrationInProgressRef.current = true;
    setIsMigrating(true);

    try {
      console.log("[Auth] Migrating guest data from", oldGuestId, "to", newUserId);

      // 1. Update all workouts with new user_id and add to sync queue
      const workouts = await offlineDb.workouts
        .where("user_id")
        .equals(oldGuestId)
        .toArray();

      const workoutIds = workouts.map(w => w.id);

      for (const workout of workouts) {
        // Update local data
        await offlineDb.workouts.update(workout.id, {
          user_id: newUserId,
          _synced: false,
        });

        // Add to sync queue for upload to server
        await syncQueue.enqueue("workouts", "create", workout.id, {
          id: workout.id,
          user_id: newUserId,
          date: workout.date,
          notes: workout.notes,
          photo_url: workout.photo_url,
          is_locked: workout.is_locked,
        });
      }

      // 2. Update all workout_sets for migrated workouts and add to sync queue
      let setsCount = 0;
      if (workoutIds.length > 0) {
        const workoutSets = await offlineDb.workoutSets
          .where("workout_id")
          .anyOf(workoutIds)
          .toArray();

        for (const set of workoutSets) {
          // Update local data
          await offlineDb.workoutSets.update(set.id, {
            _synced: false,
          });

          // Add to sync queue for upload to server
          await syncQueue.enqueue("workout_sets", "create", set.id, {
            id: set.id,
            workout_id: set.workout_id,
            exercise_id: set.exercise_id,
            set_number: set.set_number,
            reps: set.reps,
            weight: set.weight,
            distance_km: set.distance_km,
            duration_minutes: set.duration_minutes,
            plank_seconds: set.plank_seconds,
          });
        }
        setsCount = workoutSets.length;
      }

      // 3. Update all custom exercises created by guest and add to sync queue
      const exercises = await offlineDb.exercises
        .where("user_id")
        .equals(oldGuestId)
        .toArray();

      for (const exercise of exercises) {
        // Update local data
        await offlineDb.exercises.update(exercise.id, {
          user_id: newUserId,
          _synced: false,
        });

        // Add to sync queue for upload to server (only custom exercises, not presets)
        if (!exercise.is_preset) {
          await syncQueue.enqueue("exercises", "create", exercise.id, {
            id: exercise.id,
            user_id: newUserId,
            name: exercise.name,
            type: exercise.type,
            image_url: exercise.image_url,
            is_preset: false,
          });
        }
      }

      // 4. Update favorite exercises and add to sync queue
      const favorites = await offlineDb.favoriteExercises
        .where("user_id")
        .equals(oldGuestId)
        .toArray();

      for (const fav of favorites) {
        // Update local data
        await offlineDb.favoriteExercises.update(fav.id, {
          user_id: newUserId,
          _synced: false,
        });

        // Add to sync queue for upload to server
        await syncQueue.enqueue("favorite_exercises", "create", fav.id, {
          id: fav.id,
          user_id: newUserId,
          exercise_id: fav.exercise_id,
        });
      }

      // 5. Clear guest data from localStorage
      clearGuestData();

      // 6. Invalidate React Query cache to refetch with new user_id
      await queryClient.invalidateQueries({ queryKey: ["workouts"] });
      await queryClient.invalidateQueries({ queryKey: ["exercises"] });
      await queryClient.invalidateQueries({ queryKey: ["favoriteExercises"] });

      console.log("[Auth] Guest data migration complete and queued for sync. Workouts:", workouts.length, "Sets:", setsCount, "Exercises:", exercises.length, "Favorites:", favorites.length);
    } catch (error) {
      console.error("[Auth] Failed to migrate guest data:", error);
    } finally {
      migrationInProgressRef.current = false;
      setIsMigrating(false);
    }
  }, [queryClient]);

  // Confirm migration - merge guest data with account
  const confirmMigration = useCallback(async () => {
    if (pendingMigrationUserId && pendingMigrationGuestId) {
      await migrateGuestData(pendingMigrationUserId, pendingMigrationGuestId);
    }
    // Clear dialog state
    setShowMigrationDialog(false);
    setPendingMigrationUserId(null);
    setPendingMigrationGuestId(null);
    setPendingMigrationWorkoutCount(0);
    // Clear guest mode
    setIsGuest(false);
    setGuestUserId(null);
    guestUserIdRef.current = null;
    isGuestRef.current = false;
  }, [pendingMigrationUserId, pendingMigrationGuestId, migrateGuestData]);

  // Discard guest data - just clear it without migrating
  const discardGuestData = useCallback(async () => {
    if (pendingMigrationGuestId) {
      // Delete guest workouts and related data from IndexedDB
      const workouts = await offlineDb.workouts
        .where("user_id")
        .equals(pendingMigrationGuestId)
        .toArray();

      const workoutIds = workouts.map(w => w.id);

      // Delete workout sets for guest workouts
      if (workoutIds.length > 0) {
        await offlineDb.workoutSets
          .where("workout_id")
          .anyOf(workoutIds)
          .delete();
      }

      // Delete guest workouts
      await offlineDb.workouts
        .where("user_id")
        .equals(pendingMigrationGuestId)
        .delete();

      // Delete guest exercises
      await offlineDb.exercises
        .where("user_id")
        .equals(pendingMigrationGuestId)
        .delete();

      // Delete guest favorites
      await offlineDb.favoriteExercises
        .where("user_id")
        .equals(pendingMigrationGuestId)
        .delete();

      // Clear guest localStorage
      clearGuestData();

      console.log("[Auth] Guest data discarded");
    }

    // Clear dialog state
    setShowMigrationDialog(false);
    setPendingMigrationUserId(null);
    setPendingMigrationGuestId(null);
    setPendingMigrationWorkoutCount(0);
    // Clear guest mode
    setIsGuest(false);
    setGuestUserId(null);
    guestUserIdRef.current = null;
    isGuestRef.current = false;
  }, [pendingMigrationGuestId]);

  // Check if user already has workouts on the server (existing account)
  const checkExistingAccountData = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const { count } = await supabase
        .from("workouts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      return (count ?? 0) > 0;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log("[Auth] getSession result:", session?.user?.id);

      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      // Check for guest data that needs migration
      const storedGuestId = getGuestUserId();
      const hasGuestData = storedGuestId && isGuestUserId(storedGuestId);

      console.log("[Auth] Initial load - storedGuestId:", storedGuestId, "hasGuestData:", hasGuestData);

      // Also check IndexedDB directly
      if (storedGuestId) {
        const guestWorkouts = await offlineDb.workouts
          .where("user_id")
          .equals(storedGuestId)
          .count();
        console.log("[Auth] Guest workouts in IndexedDB:", guestWorkouts);
      }

      // Cache user ID for offline access
      if (currentUser) {
        localStorage.setItem("reppy_user_id", currentUser.id);
        localStorage.setItem("reppy_user_email", currentUser.email || "");

        // If there's guest data, migrate it to the authenticated user
        if (hasGuestData) {
          console.log("[Auth] Found guest data on initial load, migrating from", storedGuestId, "to", currentUser.id);
          await migrateGuestData(currentUser.id, storedGuestId);

          // Verify migration
          const migratedWorkouts = await offlineDb.workouts
            .where("user_id")
            .equals(currentUser.id)
            .count();
          console.log("[Auth] After migration - workouts with new user_id:", migratedWorkouts);
        }

        // Clear guest mode if user is authenticated
        setIsGuest(false);
        setGuestUserId(null);
      } else {
        // No session - check for existing guest ID or cached user
        const existingGuestId = getGuestUserId();
        const cachedUserId = localStorage.getItem("reppy_user_id");

        if (existingGuestId) {
          // Restore existing guest mode
          setGuestUserId(existingGuestId);
          setIsGuest(true);
          setUser(null);
          setSession(null);
          // Also update refs for migration callback
          guestUserIdRef.current = existingGuestId;
          isGuestRef.current = true;
        } else if (!cachedUserId) {
          // No existing guest and no cached user - initialize new guest mode
          initGuestMode();
        }
      }

      setLoading(false);
    }).catch(() => {
      // If offline, try to restore from cache or guest mode
      const existingGuestId = getGuestUserId();
      const cachedUserId = localStorage.getItem("reppy_user_id");
      const cachedEmail = localStorage.getItem("reppy_user_email");

      if (existingGuestId) {
        // Restore existing guest mode
        setGuestUserId(existingGuestId);
        setIsGuest(true);
        setUser(null);
        setSession(null);
        // Also update refs for migration callback
        guestUserIdRef.current = existingGuestId;
        isGuestRef.current = true;
      } else if (cachedUserId) {
        // Create minimal user object for offline use
        setUser({ id: cachedUserId, email: cachedEmail } as User);
      } else {
        // No cached user - initialize new guest mode
        initGuestMode();
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("[Auth] onAuthStateChange event:", event, "user:", session?.user?.id);

        const currentUser = session?.user ?? null;

        // Check for guest data in localStorage BEFORE any state changes
        // This is more reliable than refs which can be stale
        const storedGuestId = getGuestUserId();
        const hasGuestData = storedGuestId && isGuestUserId(storedGuestId);

        console.log("[Auth] Guest data check - storedGuestId:", storedGuestId, "hasGuestData:", hasGuestData);

        setSession(session);
        setUser(currentUser);

        // Cache user ID for offline access
        if (currentUser) {
          localStorage.setItem("reppy_user_id", currentUser.id);
          localStorage.setItem("reppy_user_email", currentUser.email || "");

          // Sync user metadata to profile (for display_name and username from signup)
          // This ensures data from signUp options.data is saved to profile
          // Use retry logic because the profile might not exist yet (trigger creates it async)
          if (event === "SIGNED_IN" || event === "USER_UPDATED") {
            const metadata = currentUser.user_metadata;
            if (metadata?.display_name || metadata?.username) {
              const updateData: Record<string, string> = {};
              if (metadata.display_name) updateData.display_name = metadata.display_name;
              if (metadata.username) updateData.username = metadata.username;

              // Retry function with delay
              const syncMetadataWithRetry = async (retries = 3, delay = 500) => {
                // Initial delay to let the database trigger create the profile first
                await new Promise(r => setTimeout(r, 300));

                for (let i = 0; i < retries; i++) {
                  // Wait before retrying
                  if (i > 0) await new Promise(r => setTimeout(r, delay));

                  const { error, data } = await supabase
                    .from("profiles")
                    .update(updateData)
                    .eq("user_id", currentUser.id)
                    .select()
                    .single();

                  if (!error && data) {
                    console.log("[Auth] Synced user metadata to profile:", updateData);
                    // Invalidate profile query to refresh UI
                    queryClient.invalidateQueries({ queryKey: ["profile"] });
                    return;
                  }

                  console.log(`[Auth] Retry ${i + 1}/${retries} - profile sync failed:`, error?.message);
                }
                console.error("[Auth] Failed to sync user metadata to profile after retries");
              };

              // Run async without blocking
              syncMetadataWithRetry();
            }
          }

          // If there's guest data in localStorage and user just signed in
          // Include INITIAL_SESSION for cases when page reloads after OAuth
          if (hasGuestData && (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "INITIAL_SESSION")) {
            // Count guest workouts
            const guestWorkoutCount = await offlineDb.workouts
              .where("user_id")
              .equals(storedGuestId)
              .count();

            if (guestWorkoutCount > 0) {
              // Check if this is an existing account with data
              const isExistingAccount = await checkExistingAccountData(currentUser.id);

              if (isExistingAccount) {
                // Existing account - show dialog to ask user
                console.log("[Auth] Existing account detected, showing migration dialog");
                setPendingMigrationUserId(currentUser.id);
                setPendingMigrationGuestId(storedGuestId);
                setPendingMigrationWorkoutCount(guestWorkoutCount);
                setShowMigrationDialog(true);
                // Don't clear guest mode yet - wait for user decision
                setLoading(false);
                return;
              } else {
                // New account - auto-migrate
                console.log("[Auth] New account, auto-migrating guest data");
                await migrateGuestData(currentUser.id, storedGuestId);
              }
            } else {
              // No guest workouts - just clear guest data
              clearGuestData();
            }
          }

          // Clear guest mode
          setIsGuest(false);
          setGuestUserId(null);
          // Also clear refs
          guestUserIdRef.current = null;
          isGuestRef.current = false;
        }

        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [initGuestMode, migrateGuestData, checkExistingAccountData]);

  const signUp = async (email: string, password: string, displayName?: string, username?: string) => {
    // Generate username from email if not provided
    const generatedUsername = username || email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "") + Math.floor(Math.random() * 1000);

    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          username: generatedUsername,
        },
      },
    });
    if (error) throw error;

    // If email confirmation is disabled in Supabase, manually send verification email
    // This allows "soft" confirmation - user can use app but sees banner until confirmed
    if (data.user && !data.user.email_confirmed_at) {
      // Send verification email (ignore errors - user is already signed up)
      supabase.auth.resend({
        type: "signup",
        email: email,
      }).catch(() => {
        // Silently ignore - verification email is nice-to-have
        console.log("[Auth] Could not send verification email");
      });
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    // Используем local scope чтобы избежать 403 ошибок при истекшей сессии
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    // Игнорируем ошибку "Auth session missing" - пользователь уже вышел
    if (error && error.message !== 'Auth session missing!') {
      throw error;
    }
    // Clear cached user data
    localStorage.removeItem("reppy_user_id");
    localStorage.removeItem("reppy_user_email");
    // Принудительно очищаем состояние на клиенте
    setSession(null);
    setUser(null);
    // Инициализируем гостевой режим сразу после выхода
    initGuestMode();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  };

  const resendVerificationEmail = async () => {
    if (!user?.email) throw new Error("No email address");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: user.email,
    });
    if (error) throw error;
  };

  // Check if email is verified (Google users are always verified)
  // Use session.user for accurate data (cached user from localStorage doesn't have full metadata)
  const sessionUser = session?.user;

  // Email is verified if:
  // 1. User is a guest (no email to verify)
  // 2. No user logged in
  // 3. User confirmed their email (email_confirmed_at is set)
  // 4. User signed in with Google (always verified)
  // 5. We're offline and have no session (can't check, don't show banner)
  const isEmailVerified = Boolean(
    isGuest ||
    !user ||
    (sessionUser?.email_confirmed_at) ||
    (sessionUser?.app_metadata?.provider === "google") ||
    // Offline mode - no session available, don't show banner
    (!navigator.onLine && !session)
  );

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      isGuest,
      guestUserId,
      effectiveUserId,
      isEmailVerified,
      isMigrating,
      showMigrationDialog,
      pendingMigrationWorkoutCount,
      confirmMigration,
      discardGuestData,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      resetPassword,
      updatePassword,
      resendVerificationEmail
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
