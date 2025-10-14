import { Link, Outlet, useLocation } from 'react-router-dom';
import { Upload } from 'lucide-react';

import { AppShell } from './components/layout/AppShell';
import { Button } from './components/ui/button';
import { PERSONA_CONFIG } from './components/dashboard/PersonaQuickstart';
import { useSettings } from './settings/SettingsProvider';
import { useEventNotifications } from './hooks/useEventNotifications';

export function AppLayout() {
  const { serverConfig, settings } = useSettings();
  const { pathname } = useLocation();
  const appName = serverConfig?.app_name ?? 'DocuLens AI';
  const personaConfig = PERSONA_CONFIG[settings.persona];
  const isDocumentsScreen = pathname === '/';

  useEventNotifications();

  return (
    <AppShell
      productName={appName}
      productTagline={personaConfig.label}
      headerAction={
        <Button asChild variant={isDocumentsScreen ? 'default' : 'accent'}>
          <Link to="/">
            <Upload className="mr-2 h-4 w-4" />
            New Upload
          </Link>
        </Button>
      }
    >
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{appName}</p>
            <h2 className="text-2xl font-semibold tracking-tight">Operational Intelligence</h2>
            <p className="text-xs text-muted-foreground">{personaConfig.description}</p>
          </div>
        </div>
        <Outlet />
      </section>
    </AppShell>
  );
}

export default AppLayout;
