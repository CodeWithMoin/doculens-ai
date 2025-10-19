import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, UsersRound, GitBranch, MessageSquare, Settings, Search, Plus, Loader2 } from 'lucide-react';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { NotificationBell } from '../notifications/NotificationBell';
import { NotificationToaster } from '../notifications/NotificationToaster';
import { ProfileMenu } from '../profile/ProfileMenu';
import { fetchDocuments } from '../../api/client';
import type { DocumentEntry } from '../../api/types';

interface AppShellProps {
  headerAction?: ReactNode;
  children: ReactNode;
  productName?: string;
  productTagline?: string;
  onLaunchUpload?: () => void;
}

const NAV_ITEMS = [
  { to: '/', label: 'Intake', icon: LayoutDashboard },
  { to: '/work-queues', label: 'Work Queues', icon: UsersRound },
  { to: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { to: '/qa', label: 'QA Studio', icon: MessageSquare },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const PLAYBOOK_STEPS = [
  {
    title: 'Intake',
    description: 'Upload the paperwork, confirm detected fields, and tag urgency so processing kicks off instantly.',
  },
  {
    title: 'Routing',
    description: 'DocuLens routes items by type, risk, and region—manual overrides stay tracked for audit.',
  },
  {
    title: 'Resolution',
    description: 'Review the AI summary, add notes, and complete checklist items before exporting decisions.',
  },
];

export function AppShell({
  headerAction,
  children,
  productName = 'DocuLens AI',
  productTagline = 'Digitize every document. Route every task.',
  onLaunchUpload,
}: AppShellProps) {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchResults, setSearchResults] = useState<DocumentEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = searchValue.trim().toLowerCase();
    if (!trimmed) {
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const docs = await fetchDocuments(150);
        if (cancelled) return;

        const filtered = docs.filter((doc) => {
          const status = (doc.status ?? '').toLowerCase();
          if (status === 'deleted') {
            return false;
          }
          const haystack = [
            doc.filename,
            doc.doc_type,
            doc.summary?.summary,
            doc.document_id,
            doc.metadata ? JSON.stringify(doc.metadata) : '',
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(trimmed);
        });

        if (cancelled) return;
        setSearchResults(filtered.slice(0, 5));
          setSearchError(filtered.length ? null : `No results for “${searchValue.trim()}”.`);
        } catch (error) {
          if (cancelled) return;
          const message = error instanceof Error ? error.message : 'Unable to search documents.';
          setSearchError(message);
        setSearchResults([]);
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchValue]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (searchValue.trim()) {
      setIsSearchActive(true);
    }
  };

  const handleResultSelect = (documentId: string) => {
    navigate(`/pipeline?document=${documentId}`);
    setSearchValue('');
    setSearchResults([]);
    setSearchError(null);
    setIsSearchActive(false);
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-72 flex-shrink-0 border-r border-platinum-600 bg-platinum-900 px-6 py-8 shadow-[16px_0_48px_rgba(47,102,144,0.08)] md:sticky md:top-0 md:flex md:h-screen md:flex-col md:overflow-y-auto">
        <div className="flex h-full flex-col gap-6">
          <div className="space-y-3">
            <Badge className="w-fit border-lapis-500/40 bg-lapis-500/10 text-xs font-semibold uppercase tracking-[0.25em] text-lapis-500">
              {productName}
            </Badge>
            <h1 className="text-xl font-semibold text-foreground">{productTagline}</h1>
          </div>

          <Button type="button" className="gap-2 bg-lapis-500 text-white hover:bg-lapis-400" onClick={() => onLaunchUpload?.()}>
            <Plus className="h-4 w-4" />
            New upload
          </Button>

          <nav className="flex flex-col gap-1.5">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => sidebarLinkClass(isActive)}>
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto text-xs text-muted-foreground" />

          <div className="mt-auto rounded-2xl border border-dotted border-lapis-500/50 bg-lapis-500/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapis-600">Digitisation playbook</p>
            <ol className="mt-4 space-y-3 text-xs text-muted-foreground">
              {PLAYBOOK_STEPS.map(({ title, description }, index) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-lapis-500/40 bg-white text-xs font-semibold text-lapis-600 shadow-sm">
                    {index + 1}
                  </span>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p>{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 min-h-0 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex flex-col gap-3 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 items-center gap-3">
                <form className="relative flex-1" onSubmit={handleSearchSubmit} role="search">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    onFocus={() => setIsSearchActive(true)}
                    onBlur={() => setTimeout(() => setIsSearchActive(false), 150)}
                    placeholder="Search documents, teams, or tags…"
                    aria-label="Search workspace"
                    className="h-10 rounded-full border border-platinum-600 bg-white pl-10 pr-4 shadow"
                  />
                  {(isSearchActive && searchValue.trim()) || (searchError && searchValue.trim()) ? (
                    <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-border/70 bg-white shadow-xl">
                      {isSearching ? (
                        <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Searching…
                        </div>
                      ) : searchResults.length ? (
                        <ul className="divide-y divide-border/60">
                          {searchResults.map((doc) => (
                            <li key={doc.document_id}>
                              <button
                                type="button"
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  handleResultSelect(doc.document_id);
                                }}
                                className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left hover:bg-muted"
                              >
                                <span className="text-sm font-medium text-foreground">{doc.filename ?? doc.document_id}</span>
                                <span className="text-xs text-muted-foreground">
                                  {doc.doc_type ?? 'Unassigned'} · {new Date(doc.uploaded_at).toLocaleDateString()}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="px-4 py-3 text-sm text-muted-foreground">
                          {searchError ?? `No results for “${searchValue.trim()}”.`}
                        </div>
                      )}
                    </div>
                  ) : null}
                </form>
              </div>
              <div className="flex items-center gap-3">
                <NotificationBell />
                {headerAction}
                <ProfileMenu />
              </div>
            </div>
            <nav className="flex flex-wrap gap-2 md:hidden">
              {NAV_ITEMS.map(({ to, label }) => (
                <NavLink key={to} to={to} className={({ isActive }) => navLinkPillClass(isActive)}>
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>

        <main className="flex flex-1 min-h-0 flex-col gap-8 px-6 pb-12 pt-8 lg:px-10">{children}</main>
      </div>

      <NotificationToaster />
    </div>
  );
}

function navLinkPillClass(isActive: boolean) {
  return cn(
    'rounded-full border px-3 py-1 text-sm transition-colors',
    isActive ? 'border-border bg-card text-foreground' : 'border-transparent text-muted-foreground hover:border-border hover:bg-card',
  );
}

function sidebarLinkClass(isActive: boolean) {
  return cn(
    'group flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-medium transition-all',
    isActive
      ? 'bg-gradient-to-r from-lapis-500/15 via-lapis-500/10 to-transparent text-lapis-600 shadow-[0_12px_32px_rgba(47,102,144,0.18)] ring-1 ring-inset ring-lapis-500/40 backdrop-blur-sm'
      : 'text-muted-foreground hover:bg-lapis-500/5 hover:text-foreground',
  );
}
