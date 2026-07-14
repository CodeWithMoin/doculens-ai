import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  ChevronsUpDown,
  Command,
  FileStack,
  FolderKanban,
  LayoutDashboard,
  Loader2,
  Menu,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';

import { fetchDocuments } from '../../api/client';
import type { DocumentEntry } from '../../api/types';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores/uiStore';
import { Logo } from '../brand/Logo';
import { NotificationBell } from '../notifications/NotificationBell';
import { NotificationToaster } from '../notifications/NotificationToaster';
import { ProfileMenu } from '../profile/ProfileMenu';
import { Button } from '../ui/button';
import { ThemeToggle } from '../ui/theme-toggle';

interface AppShellProps {
  headerAction?: ReactNode;
  children: ReactNode;
  productName?: string;
  productTagline?: string;
  onLaunchUpload?: () => void;
}

const PRIMARY_NAV = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/qa', label: 'Ask DocuLens', icon: MessageSquareText },
  { to: '/app/pipeline', label: 'Documents', icon: FileStack },
  { to: '/app/work-queues', label: 'Work queues', icon: FolderKanban },
];

const SECONDARY_NAV = [
  { to: '/app/pipeline', label: 'Activity', icon: Activity },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

const PAGE_META: Record<string, { title: string; description: string }> = {
  '/app': { title: 'Workspace', description: 'Your documents, decisions, and active work in one place.' },
  '/app/qa': { title: 'Ask DocuLens', description: 'Explore your documents with answers grounded in source evidence.' },
  '/app/pipeline': { title: 'Documents', description: 'Review summaries, classifications, source content, and processing status.' },
  '/app/work-queues': { title: 'Work queues', description: 'Route documents to the right team and keep decisions moving.' },
  '/app/settings': { title: 'Workspace settings', description: 'Configure models, retrieval, access, and preferences.' },
};

export function AppShell({ headerAction, children, onLaunchUpload }: AppShellProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isSidebarOpen, isSidebarCollapsed, toggleSidebar, toggleSidebarCollapsed } = useUIStore();
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState<DocumentEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const page = PAGE_META[pathname] ?? PAGE_META['/app'];

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandOpen((open) => !open);
      }
      if (event.key === 'Escape') {
        setIsCommandOpen(false);
        toggleSidebar(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [toggleSidebar]);

  useEffect(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    const timer = window.setTimeout(() => {
      fetchDocuments(150)
        .then((documents) => {
          if (cancelled) return;
          const matches = documents.filter((document) => [document.filename, document.doc_type, document.summary?.summary, document.document_id].filter(Boolean).join(' ').toLowerCase().includes(query));
          setSearchResults(matches.slice(0, 6));
          setSearchError(matches.length ? null : `No documents match “${searchValue.trim()}”`);
        })
        .catch((error: unknown) => !cancelled && setSearchError(error instanceof Error ? error.message : 'Search is unavailable.'))
        .finally(() => !cancelled && setIsSearching(false));
    }, 160);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [searchValue]);

  const selectDocument = (id: string) => {
    navigate(`/app/pipeline?document=${id}`);
    setIsCommandOpen(false);
    setSearchValue('');
  };

  const openDestination = (path: string) => {
    navigate(path);
    setIsCommandOpen(false);
    setSearchValue('');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {isSidebarOpen ? <button className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => toggleSidebar(false)} aria-label="Close navigation" /> : null}
      <aside className={cn('fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-border/70 bg-surface-subtle/80 px-3 py-3 backdrop-blur-xl transition-[width,transform] duration-300 lg:translate-x-0', isSidebarOpen ? 'translate-x-0' : '-translate-x-full', isSidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-[248px]')}>
        <div className={cn('flex h-11 items-center justify-between px-2', isSidebarCollapsed && 'lg:justify-center lg:px-0')}>
          <Logo className={cn(isSidebarCollapsed && 'lg:hidden')} />
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg lg:hidden" onClick={() => toggleSidebar(false)}><X className="h-4 w-4" /></Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-8 w-8 shrink-0 rounded-lg text-muted-foreground lg:inline-flex"
            onClick={() => toggleSidebarCollapsed()}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
        <button title="Acme workspace" className={cn('mt-3 flex w-full items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-2.5 text-left shadow-sm transition hover:border-muted-foreground/30', isSidebarCollapsed && 'lg:justify-center lg:px-2')}>
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-foreground text-[10px] font-semibold text-background">AC</span>
          <span className={cn('min-w-0 flex-1', isSidebarCollapsed && 'lg:hidden')}><span className="block truncate text-xs font-semibold">Acme workspace</span><span className="block text-[10px] text-muted-foreground">Production</span></span>
          <ChevronsUpDown className={cn('h-3.5 w-3.5 text-muted-foreground', isSidebarCollapsed && 'lg:hidden')} />
        </button>
        {onLaunchUpload ? <Button onClick={onLaunchUpload} title="Add documents" className={cn('mt-3 w-full justify-start gap-2 rounded-xl', isSidebarCollapsed && 'lg:justify-center lg:px-0')}><Plus className="h-4 w-4" /><span className={cn(isSidebarCollapsed && 'lg:hidden')}>Add documents</span></Button> : <div className={cn('mt-3 flex items-center gap-2 rounded-xl border border-border/70 bg-background px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground', isSidebarCollapsed && 'lg:justify-center lg:px-0')}><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /><span className={cn(isSidebarCollapsed && 'lg:hidden')}>Public showcase</span></div>}

        <nav className="mt-6 space-y-1" aria-label="Workspace navigation">
          {PRIMARY_NAV.map((item) => <SidebarLink key={item.label} {...item} collapsed={isSidebarCollapsed} onClick={() => toggleSidebar(false)} />)}
        </nav>

        <div className={cn('mt-7 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60', isSidebarCollapsed && 'lg:hidden')}>Collections</div>
        <nav className="mt-2 space-y-0.5">
          {['Board materials', 'Customer research', 'Compliance'].map((label, index) => (
            <button key={label} title={label} className={cn('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-muted-foreground transition hover:bg-background hover:text-foreground', isSidebarCollapsed && 'lg:justify-center lg:px-2')}>
              <span className={cn('h-2 w-2 rounded-[3px]', index === 0 ? 'bg-blue-500' : index === 1 ? 'bg-emerald-500' : 'bg-amber-400')} /><span className={cn(isSidebarCollapsed && 'lg:hidden')}>{label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-1 border-t border-border/70 pt-3">
          {SECONDARY_NAV.map((item) => <SidebarLink key={item.label} {...item} collapsed={isSidebarCollapsed} onClick={() => toggleSidebar(false)} />)}
          <div className={cn('mt-3 rounded-xl border border-border/70 bg-background p-3', isSidebarCollapsed && 'lg:hidden')}>
            <div className="flex items-center justify-between text-[10px]"><span className="font-semibold">Vector storage</span><span className="text-muted-foreground">62%</span></div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full w-[62%] rounded-full bg-primary" /></div>
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">12.4k of 20k chunks indexed</p>
          </div>
        </div>
      </aside>

      <div className={cn('transition-[padding] duration-300', isSidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[248px]')}>
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Button variant="ghost" size="icon" className="rounded-lg lg:hidden" onClick={() => toggleSidebar(true)}><Menu className="h-4 w-4" /></Button>
            <button onClick={() => setIsCommandOpen(true)} className="flex h-9 min-w-0 max-w-md flex-1 items-center gap-2 rounded-xl border border-border/70 bg-surface-subtle px-3 text-xs text-muted-foreground shadow-sm transition hover:border-muted-foreground/30 hover:bg-background">
              <Search className="h-3.5 w-3.5" /><span className="truncate">Search documents…</span><span className="ml-auto hidden items-center gap-0.5 rounded-md border border-border bg-background px-1.5 py-0.5 font-mono text-[9px] sm:flex"><Command className="h-2.5 w-2.5" />K</span>
            </button>
            <div className="ml-auto flex items-center gap-1"><ThemeToggle /><NotificationBell />{headerAction}<ProfileMenu /></div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] px-4 pb-12 pt-7 sm:px-6 lg:px-8 lg:pt-9">
          <div className="mx-auto max-w-[1440px]">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div><h1 className="text-2xl font-semibold tracking-[-0.035em] md:text-[28px]">{page.title}</h1><p className="mt-1.5 text-sm text-muted-foreground">{page.description}</p></div>
              <span className="hidden items-center gap-1.5 rounded-full border border-border bg-surface-subtle px-3 py-1.5 text-[10px] font-medium text-muted-foreground sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> All systems operational</span>
            </div>
            {children}
          </div>
        </main>
      </div>

      {isCommandOpen ? (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-950/35 px-4 pt-[14vh] backdrop-blur-[6px]" role="dialog" aria-modal="true" aria-label="Search workspace" onMouseDown={() => setIsCommandOpen(false)}>
          <div className="w-full max-w-[540px] overflow-hidden rounded-[20px] border border-border/90 bg-card shadow-[0_28px_90px_rgba(10,15,25,0.28)] dark:shadow-[0_32px_100px_rgba(0,0,0,0.5)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="border-b border-border/70 p-3">
              <form onSubmit={(event: FormEvent) => event.preventDefault()} className="flex h-12 items-center gap-3 rounded-xl border border-border/80 bg-surface-subtle px-3 shadow-sm transition focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input autoFocus value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="Search documents and summaries…" className="h-full min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 text-sm text-foreground shadow-none outline-none placeholder:text-muted-foreground focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0" />
                <button type="button" onClick={() => setIsCommandOpen(false)} aria-label="Close search" className="shrink-0 rounded-md border border-border bg-background/70 px-1.5 py-1 font-mono text-[9px] text-muted-foreground transition hover:text-foreground">ESC</button>
              </form>
            </div>
            <div className="max-h-[360px] overflow-y-auto p-2">
              {!searchValue.trim() ? <CommandEmpty onNavigate={openDestination} /> : isSearching ? <div className="flex items-center gap-2 px-3 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Searching your workspace…</div> : searchResults.length ? searchResults.map((document) => <button key={document.document_id} onClick={() => selectDocument(document.document_id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-surface-subtle"><span className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-background"><FileStack className="h-3.5 w-3.5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{document.filename ?? document.document_id}</span><span className="mt-0.5 block text-[10px] text-muted-foreground">{document.doc_type ?? 'Unclassified'} · {document.status ?? 'Processing'}</span></span><ChevronHint /></button>) : <p className="px-3 py-8 text-center text-sm text-muted-foreground">{searchError}</p>}
            </div>
          </div>
        </div>
      ) : null}
      <NotificationToaster />
    </div>
  );
}

function SidebarLink({ to, label, icon: Icon, end, collapsed, onClick }: { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; collapsed: boolean; onClick: () => void }) {
  return <NavLink to={to} end={end} onClick={onClick} title={label} className={({ isActive }) => cn('group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-all', collapsed && 'lg:justify-center lg:px-2', isActive ? 'bg-background text-foreground shadow-sm ring-1 ring-border/70' : 'text-muted-foreground hover:bg-background/70 hover:text-foreground')}><Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} /><span className={cn(collapsed && 'lg:hidden')}>{label}</span></NavLink>;
}
function ChevronHint() { return <span className="font-mono text-[9px] text-muted-foreground">↵</span>; }
function CommandEmpty({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div className="p-2">
      <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60">Quick actions</p>
      <button type="button" onClick={() => onNavigate('/app/qa')} className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-surface-subtle">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">Ask DocuLens</span><span className="block text-[10px] text-muted-foreground">Ask a cited question about your workspace</span></span>
        <ChevronHint />
      </button>
      <button type="button" onClick={() => onNavigate('/app/pipeline')} className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-surface-subtle">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600"><FileStack className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">Browse documents</span><span className="block text-[10px] text-muted-foreground">Review summaries, sources, and status</span></span>
        <ChevronHint />
      </button>
    </div>
  );
}
