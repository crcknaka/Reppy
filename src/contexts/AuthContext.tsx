import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  getOrCreateGuestUserId,
  getGuestUserId,
  clearGuestData,
  isGuestUserId
} from "@/lib/guestUser";
import { offlineDb } from "@/offline/db";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isGuest: boolean;
  guestUserId: string | null;
  effectiveUserId: string | null;
  signUp: (email: string, password: string, displayName?: string, username?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  // Start with cached user for immediate offline access
  const [user, setUser] = useState<User | null>(getCachedUser);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [guestUserId, setGuestUserId] = useState<string | null>(null);

  // Refs to keep track of guest state for migration (avoids stale closure issues)
  const guestUserIdRef = useRef<string | null>(null);
  const isGuestRef = useRef<boolean>(false);

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
    try {
      console.log("[Auth] Migrating guest data from", oldGuestId, "to", newUserId);

      // 1. Update all workouts with new user_id
      const workouts = await offlineDb.workouts
        .where("user_id")
        .equals(oldGuestId)
        .toArray();

      const workoutIds = workouts.map(w => w.id);

      for (const workout of workouts) {
        await offlineDb.workouts.update(workout.id, {
          user_id: newUserId,
          _synced: false,
        });
      }

      // 2. Update all workout_sets for migrated workouts (mark as unsynced)
      let setsCount = 0;
      if (workoutIds.length > 0) {
        const workoutSets = await offlineDb.workoutSets
          .where("workout_id")
          .anyOf(workoutIds)
          .toArray();

        for (const set of workoutSets) {
          await offlineDb.workoutSets.update(set.id, {
            _synced: false,
          });
        }
        setsCount = workoutSets.length;
      }

      // 3. Update all custom exercises created by guest
      const exercises = await offlineDb.exercises
        .where("user_id")
        .equals(oldGuestId)
        .toArray();

      for (const exercise of exercises) {
        await offlineDb.exercises.update(exercise.id, {
          user_id: newUserId,
          _synced: false,
        });
      }

      // 4. Update favorite exercises
      const favorites = await offlineDb.favoriteExercises
        .where("user_id")
        .equals(oldGuestId)
        .toArray();

      for (const fav of favorites) {
        await offlineDb.favoriteExercises.update(fav.id, {
          user_id: newUserId,
          _synced: false,
        });
      }

      // 5. Clear guest data from localStorage
      clearGuestData();

      console.log("[Auth] Guest data migration complete. Workouts:", workouts.length, "Sets:", setsCount, "Exercises:", exercises.length, "Favorites:", favorites.length);
    } catch (error) {
      console.error("[Auth] Failed to migrate guest data:", error);
    }
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      // Cache user ID for offline access
      if (currentUser) {
        localStorage.setItem("reppy_user_id", currentUser.id);
        localStorage.setItem("reppy_user_email", currentUser.email || "");
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
        const currentUser = session?.user ?? null;
        // Use refs to get current guest state (avoids stale closure)
        const previousGuestId = guestUserIdRef.current;
        const wasGuest = isGuestRef.current;

        setSession(session);
        setUser(currentUser);

        // Cache user ID for offline access
        if (currentUser) {
          localStorage.setItem("reppy_user_id", currentUser.id);
          localStorage.setItem("reppy_user_email", currentUser.email || "");

          // If user was a guest and now signed in, migrate guest data
          if (wasGuest && previousGuestId && (event === "SIGNED_IN" || event === "USER_UPDATED")) {
            await migrateGuestData(currentUser.id, previousGuestId);
          }

          // Clear guest mode
          setIsGuest(false);
          setGuestUserId(null);
        }

        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [initGuestMode, migrateGuestData]);

  const signUp = async (email: string, password: string, displayName?: string, username?: string) => {
    // Generate username from email if not provided
    const generatedUsername = username || email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "") + Math.floor(Math.random() * 1000);

    const { error } = await supabase.auth.signUp({
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

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      isGuest,
      guestUserId,
      effectiveUserId,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      resetPassword,
      updatePassword
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
