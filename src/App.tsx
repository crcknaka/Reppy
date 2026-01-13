import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { OfflineProvider } from "@/contexts/OfflineContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { OfflineIndicator } from "@/offline/components/OfflineIndicator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Layout from "@/components/Layout";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import { Loader2 } from "lucide-react";
import { useEffect, lazy, Suspense } from "react";
import { setupGlobalErrorHandlers } from "@/lib/setupErrorHandlers";

// Initialize global error handlers
setupGlobalErrorHandlers();

// Lazy load pages for better code splitting
const Auth = lazy(() => import("@/pages/Auth"));
const Workouts = lazy(() => import("@/pages/Workouts"));
const WorkoutDetail = lazy(() => import("@/pages/WorkoutDetail"));
const Progress = lazy(() => import("@/pages/Progress"));
const Friends = lazy(() => import("@/pages/Friends"));
const Exercises = lazy(() => import("@/pages/Exercises"));
const Settings = lazy(() => import("@/pages/Settings"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const SharedWorkout = lazy(() => import("@/pages/SharedWorkout"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// Admin pages
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminCleanup = lazy(() => import("@/pages/admin/AdminCleanup"));
const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminExercises = lazy(() => import("@/pages/admin/AdminExercises"));
const AdminLogs = lazy(() => import("@/pages/admin/AdminLogs"));

// Schema version - increment this when you make breaking database changes
const SCHEMA_VERSION = "2"; // Updated for cardio exercise type

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // CRITICAL: Always run queryFn even when offline
      // This allows our offline-first hooks to return cached IndexedDB data
      networkMode: "always",
      // Don't retry when offline
      retry: (failureCount) => {
        // Don't retry network errors when offline
        if (!navigator.onLine) return false;
        // Default retry logic: 3 attempts
        return failureCount < 3;
      },
      // Don't refetch on window focus when offline
      refetchOnWindowFocus: () => navigator.onLine,
      // Don't refetch on reconnect - we handle this manually in OfflineContext
      refetchOnReconnect: false,
      // Keep stale data visible while fetching
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
    mutations: {
      // CRITICAL: Always run mutationFn even when offline
      // This allows offline mutations to work with IndexedDB + sync queue
      networkMode: "always",
      // Don't retry mutations when offline
      retry: false,
    },
  },
});

// Check schema version and clear cache if needed
function useSchemaVersionCheck() {
  useEffect(() => {
    const storedVersion = localStorage.getItem("schema_version");
    if (storedVersion !== SCHEMA_VERSION) {
      console.log(`Schema version mismatch (stored: ${storedVersion}, current: ${SCHEMA_VERSION}). Clearing cache...`);
      queryClient.clear();
      localStorage.setItem("schema_version", SCHEMA_VERSION);
    }
  }, []);
}

// Loading fallback component
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <Layout>{children}</Layout>;
}

// Preload all lazy-loaded pages for offline support
function usePreloadPages() {
  useEffect(() => {
    // Only preload when online to cache chunks for offline use
    if (navigator.onLine) {
      // Small delay to let critical resources load first
      const timer = setTimeout(() => {
        import("@/pages/Auth");
        import("@/pages/Workouts");
        import("@/pages/WorkoutDetail");
        import("@/pages/Progress");
        import("@/pages/Friends");
        import("@/pages/Exercises");
        import("@/pages/Settings");
        import("@/pages/ResetPassword");
        import("@/pages/SharedWorkout");
        import("@/pages/NotFound");
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);
}

function AppRoutes() {
  // Check and update schema version on app load
  useSchemaVersionCheck();
  // Preload all pages for offline support
  usePreloadPages();

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/share/:token" element={<SharedWorkout />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Workouts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workout/:id"
          element={
            <ProtectedRoute>
              <WorkoutDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/progress"
          element={
            <ProtectedRoute>
              <Progress />
            </ProtectedRoute>
          }
        />
        <Route
          path="/friends"
          element={
            <ProtectedRoute>
              <Friends />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exercises"
          element={
            <ProtectedRoute>
              <Exercises />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminDashboard />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/cleanup"
          element={
            <AdminProtectedRoute>
              <AdminCleanup />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminProtectedRoute>
              <AdminUsers />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/exercises"
          element={
            <AdminProtectedRoute>
              <AdminExercises />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/logs"
          element={
            <AdminProtectedRoute>
              <AdminLogs />
            </AdminProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <AuthProvider>
              <OfflineProvider>
                <OfflineIndicator />
                <AppRoutes />
              </OfflineProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
