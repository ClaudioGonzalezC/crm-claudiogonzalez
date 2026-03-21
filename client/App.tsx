import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { setupAuthInterceptor } from "@/services/apiClient";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ClientDirectory from "./pages/ClientDirectory";
import Dashboard from "./pages/Dashboard";
import ProjectForm from "./pages/ProjectForm";
import ProjectDetail from "./pages/ProjectDetail";
import ProjectsList from "./pages/ProjectsList";
import CustomerView from "./pages/CustomerView";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import TeamManagement from "./pages/TeamManagement";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Setup auth interceptor on app load
setupAuthInterceptor();

const queryClient = new QueryClient();

const App = () => (
  <AuthProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <Routes>
            {/* Public Login Route */}
            <Route path="/login" element={<Login />} />

            {/* Public Customer Portal Route - accessible without auth */}
            <Route
              path="/cliente/:shareToken"
              element={
                <ErrorBoundary>
                  <CustomerView />
                </ErrorBoundary>
              }
            />

            {/* Protected Admin Routes - require authentication */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/nuevo-cliente"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />
            <Route
              path="/nuevo-proyecto"
              element={
                <ProtectedRoute>
                  <ProjectForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/proyectos"
              element={
                <ProtectedRoute>
                  <ProjectsList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/clientes"
              element={
                <ProtectedRoute>
                  <ClientDirectory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/proyecto/:projectId"
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <ProjectDetail />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ajustes"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/equipo"
              element={
                <ProtectedRoute>
                  <TeamManagement />
                </ProtectedRoute>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AuthProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
