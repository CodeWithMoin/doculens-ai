import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Upload, X } from 'lucide-react';

import { AppShell } from './components/layout/AppShell';
import { Button } from './components/ui/button';
import { useEventNotifications } from './hooks/useEventNotifications';
import { DocumentUploadForm } from './components/DocumentUploadForm';
import type { UploadResponse } from './api/types';
import { Badge } from './components/ui/badge';
import { useSettings } from './settings/useSettings';

export function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isIntake = pathname === '/app';
  const { serverConfig } = useSettings();
  const isShowcaseReadOnly = Boolean(serverConfig?.showcase_read_only);
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
      navigate('/app/pipeline', { replace: false, state: { recentUpload: response.event_id } });
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
        onLaunchUpload={isShowcaseReadOnly ? undefined : handleOpenUpload}
        headerAction={
          isShowcaseReadOnly ? (
            <Badge variant="outline" className="hidden rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] sm:inline-flex">
              Read-only showcase · synthetic data
            </Badge>
          ) : (
            <Button
              type="button"
              variant={isIntake ? 'default' : 'outline'}
              size="sm"
              className="hidden gap-2 rounded-full sm:inline-flex"
              onClick={handleOpenUpload}
              data-open-upload
            >
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          )
        }
      >
        <Outlet />
      </AppShell>

      {isUploadOpen && !isShowcaseReadOnly ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/20 px-4 backdrop-blur-sm">
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-border bg-card shadow-[0_32px_100px_rgba(20,18,30,0.28)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-dialog-title"
          >
            <header className="flex items-center justify-between border-b border-border/60 px-6 py-4">
              <div>
                <h3 id="upload-dialog-title" className="text-lg font-semibold text-foreground">
                  Add documents
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">Upload PDFs, scans, or text files to your workspace.</p>
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
