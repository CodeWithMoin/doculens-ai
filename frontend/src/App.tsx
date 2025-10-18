import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Upload, X } from 'lucide-react';

import { AppShell } from './components/layout/AppShell';
import { Button } from './components/ui/button';
import { useSettings } from './settings/useSettings';
import { useEventNotifications } from './hooks/useEventNotifications';
import { DocumentUploadForm } from './components/DocumentUploadForm';
import type { UploadResponse } from './api/types';

export function AppLayout() {
  const { serverConfig } = useSettings();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const appName = serverConfig?.app_name ?? 'DocuLens AI';
  const isIntake = pathname === '/';
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  useEventNotifications();

  const handleOpenUpload = useCallback(() => {
    setIsUploadOpen(true);
  }, []);

  const handleCloseUpload = useCallback(() => {
    setIsUploadOpen(false);
  }, []);

  const handleUploadComplete = useCallback(
    (response: UploadResponse) => {
      setIsUploadOpen(false);
      navigate('/pipeline', { replace: false, state: { recentUpload: response.event_id } });
    },
    [navigate],
  );

  useEffect(() => {
    if (!isUploadOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUploadOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isUploadOpen]);

  return (
    <>
      <AppShell
        productName={appName}
        productTagline="Digitize every document. Route every task."
        onLaunchUpload={handleOpenUpload}
        headerAction={
          <Button
            type="button"
            variant={isIntake ? 'default' : 'accent'}
            className="gap-2"
            onClick={handleOpenUpload}
            data-open-upload
          >
            <Upload className="h-4 w-4" />
            New Upload
          </Button>
        }
      >
        <Outlet />
      </AppShell>

      {isUploadOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div
            className="relative w-full max-w-3xl rounded-2xl border border-border/70 bg-card shadow-2xl shadow-black/20"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-dialog-title"
          >
            <header className="flex items-center justify-between border-b border-border/60 px-6 py-4">
              <div>
                <h3 id="upload-dialog-title" className="text-lg font-semibold text-foreground">
                  Upload & ingest documents
                </h3>
                <p className="text-xs text-muted-foreground">Drop in PDFs or scans to fast-track routing and review.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleCloseUpload} aria-label="Close upload dialog">
                <X className="h-4 w-4" />
              </Button>
            </header>
            <div className="max-h-[80vh] overflow-y-auto px-6 py-4">
              <DocumentUploadForm onUploaded={handleUploadComplete} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default AppLayout;
