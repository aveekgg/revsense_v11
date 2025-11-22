import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ExcelProvider } from "@/contexts/ExcelContext";
import { AuthProvider } from "@/contexts/AuthContext";
import SignUp from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import AskAI from "./pages/AskAI";
import ProjectConfig from "./pages/ProjectConfig";
import AddData from "./pages/AddData";
import BatchProcess from "./pages/BatchProcess";
import ConsolidatedData from "./pages/ConsolidatedData";
import Dashboards from "./pages/Dashboards";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/auth/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <ExcelProvider>
            <Toaster />
            <Sonner />
            <Routes>
              <Route path="/" element={<SignUp />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}>
                <Route index element={<Navigate to="/dashboard/ask-ai" replace />} />
                <Route path="ask-ai" element={<AskAI />} />
                <Route path="dashboards" element={<Dashboards />} />
                <Route path="project-config" element={<ProjectConfig />} />
                <Route path="add-data" element={<AddData />} />
                <Route path="batch-process" element={<BatchProcess />} />
                <Route path="consolidated-data" element={<ConsolidatedData />} />
              </Route>
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ExcelProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
