import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import Auth from "@/pages/Auth";
import Workouts from "@/pages/Workouts";
import WorkoutDetail from "@/pages/WorkoutDetail";
import CalendarPage from "@/pages/CalendarPage";
import Progress from "@/pages/Progress";
import Exercises from "@/pages/Exercises";
import Settings from "@/pages/Settings";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
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
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
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
        path="/calendar"
        element={
          <ProtectedRoute>
            <CalendarPage />
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
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
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
  </QueryClientProvider>
);

export default App;
