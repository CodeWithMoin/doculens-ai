import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './App';
import './styles/globals.css';
import { IntakePage } from './pages/IntakePage';
import { WorkQueuesPage } from './pages/WorkQueuesPage';
import { PipelinePage } from './pages/PipelinePage';
import { QaPage } from './pages/QaPage';
import { SettingsPage } from './pages/SettingsPage';
import { SettingsProvider } from './settings/SettingsProvider';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './auth/AuthProvider';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <SettingsProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route index element={<IntakePage />} />
                <Route path="work-queues" element={<WorkQueuesPage />} />
                <Route path="pipeline" element={<PipelinePage />} />
                <Route path="qa" element={<QaPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </SettingsProvider>
        </AuthProvider>
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} position="bottom" />
    </QueryClientProvider>
  </React.StrictMode>,
);
