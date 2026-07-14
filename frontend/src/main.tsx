import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './auth/AuthProvider';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { queryClient } from './lib/queryClient';
import { SettingsProvider } from './settings/SettingsProvider';
import './styles/globals.css';

const AppLayout = lazy(() => import('./App'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const IntakePage = lazy(() => import('./pages/IntakePage').then((module) => ({ default: module.IntakePage })));
const WorkQueuesPage = lazy(() => import('./pages/WorkQueuesPage').then((module) => ({ default: module.WorkQueuesPage })));
const PipelinePage = lazy(() => import('./pages/PipelinePage').then((module) => ({ default: module.PipelinePage })));
const QaPage = lazy(() => import('./pages/QaPage').then((module) => ({ default: module.QaPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));

export function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
        Preparing your workspace
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <SettingsProvider>
            <Suspense fallback={<RouteLoader />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/app"
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<IntakePage />} />
                  <Route path="work-queues" element={<WorkQueuesPage />} />
                  <Route path="pipeline" element={<PipelinePage />} />
                  <Route path="qa" element={<QaPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
              </Routes>
            </Suspense>
          </SettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
