import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import Layout from "@/components/Layout";
import { Loader2 } from "lucide-react";
import { useEffect, lazy, Suspense } from "react";

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

// Schema version - increment this when you make breaking database changes
const SCHEMA_VERSION = "2"; // Updated for cardio exercise type

const queryClient = new QueryClient();

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

function AppRoutes() {
  // Check and update schema version on app load
  useSchemaVersionCheck();

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
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
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
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
