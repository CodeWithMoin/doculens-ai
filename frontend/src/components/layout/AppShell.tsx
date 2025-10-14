import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, Search, X } from 'lucide-react';

import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores/uiStore';
import { NotificationBell } from '../notifications/NotificationBell';
import { NotificationToaster } from '../notifications/NotificationToaster';

interface AppShellProps {
  headerAction?: ReactNode;
  children: ReactNode;
  productName?: string;
  productTagline?: string;
}

export function AppShell({ headerAction, children, productName = 'DocuLens AI', productTagline = 'Operations Console' }: AppShellProps) {
  const { isSidebarOpen, toggleSidebar } = useUIStore();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={isSidebarOpen ? 'Close navigation' : 'Open navigation'}
              onClick={() => toggleSidebar()}
            >
              {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex flex-col">
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">{productName}</span>
              <h1 className="text-xl font-semibold leading-tight">{productTagline}</h1>
            </div>
          </div>
          <div className="hidden items-center gap-6 md:flex">
            <NavLink className={({ isActive }) => navLinkClass(isActive)} to="/">
              Documents
            </NavLink>
            <NavLink className={({ isActive }) => navLinkClass(isActive)} to="/qa">
              Workspace
            </NavLink>
            <NavLink className={({ isActive }) => navLinkClass(isActive)} to="/settings">
              Settings
            </NavLink>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="hidden md:inline-flex" aria-label="Global search">
              <Search className="h-5 w-5" />
            </Button>
            <NotificationBell />
            {headerAction}
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 pb-12 pt-8 md:px-6">
        {children}
      </main>
      <NotificationToaster />
      {isSidebarOpen ? (
        <nav className="fixed inset-x-0 top-[65px] z-40 border-b border-border/60 bg-background/95 p-6 shadow-lg md:hidden">
          <ul className="flex flex-col gap-4 text-base font-medium text-muted-foreground">
            <li>
              <NavLink className={({ isActive }) => navLinkClass(isActive)} to="/" onClick={() => toggleSidebar(false)}>
                Documents
              </NavLink>
            </li>
            <li>
              <NavLink className={({ isActive }) => navLinkClass(isActive)} to="/qa" onClick={() => toggleSidebar(false)}>
                Workspace
              </NavLink>
            </li>
            <li>
              <NavLink className={({ isActive }) => navLinkClass(isActive)} to="/settings" onClick={() => toggleSidebar(false)}>
                Settings
              </NavLink>
            </li>
          </ul>
        </nav>
      ) : null}
    </div>
  );
}

function navLinkClass(isActive: boolean) {
  return cn(
    'text-sm font-medium transition-colors hover:text-foreground/80',
    isActive ? 'text-foreground' : 'text-muted-foreground',
  );
}
