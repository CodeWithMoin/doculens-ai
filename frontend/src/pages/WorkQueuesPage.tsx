import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  FolderOpen,
  LayoutGrid,
  ListChecks,
  MoveRight,
  SlidersHorizontal,
  Users,
} from 'lucide-react';

import { fetchDocuments } from '../api/client';
import type { DocumentEntry } from '../api/types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { ROLE_ORDER, formatDateTime, inferDueDate, inferRole, inferStatus } from '../lib/routing';
import type { RoleKey } from '../lib/routing';
import { cn } from '../lib/utils';

interface QueueColumn {
  role: RoleKey;
  documents: DocumentEntry[];
}

interface QueueRoleStats {
  total: number;
  overdue: number;
  dueSoon: number;
  completed: number;
  pending: number;
}

export function WorkQueuesPage() {
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get('q') ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [activeSegment, setActiveSegment] = useState<'all' | 'overdue' | 'due-soon' | 'completed'>('all');
  const [sortOption, setSortOption] = useState<'due-soon' | 'recent-upload' | 'status'>('due-soon');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [selectedDocTypes, setSelectedDocTypes] = useState<Set<string>>(new Set());

  const selectedRole = (searchParams.get('role') as RoleKey | null) ?? 'Finance';

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetchDocuments(150)
      .then((items) =>
        setDocuments(
          items.filter((doc) => {
            const status = inferStatus(doc).toLowerCase();
            return status !== 'archived' && status !== 'deleted';
          }),
        ),
      )
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to load documents';
        setError(message);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const columns: QueueColumn[] = useMemo(() => {
    const grouped = ROLE_ORDER.reduce((acc, role) => {
      acc[role] = [] as DocumentEntry[];
      return acc;
    }, {} as Record<RoleKey, DocumentEntry[]>);

    documents.forEach((doc) => {
      const role = inferRole(doc);
      grouped[role].push(doc);
    });

    ROLE_ORDER.forEach((role) => {
      grouped[role].sort((a, b) => {
        const aDue = Date.parse(inferDueDate(a) ?? '');
        const bDue = Date.parse(inferDueDate(b) ?? '');
        return (Number.isNaN(aDue) ? Infinity : aDue) - (Number.isNaN(bDue) ? Infinity : bDue);
      });
    });

    return ROLE_ORDER.map((role) => ({
      role,
      documents: grouped[role],
    }));
  }, [documents]);

  const selectedColumn = useMemo(() => {
    return columns.find((column) => column.role === selectedRole) ?? columns[0];
  }, [columns, selectedRole]);

  const selectedDocuments = selectedColumn?.documents ?? [];

  const roleStats: QueueRoleStats = useMemo(() => {
    const now = Date.now();
    const soonThreshold = now + 48 * 60 * 60 * 1000;
    let overdue = 0;
    let dueSoon = 0;
    let completed = 0;

    for (const doc of selectedDocuments) {
      const status = inferStatus(doc).toLowerCase();
      if (status === 'completed') {
        completed += 1;
      }

      const due = inferDueDate(doc);
      if (due) {
        const dueTime = Date.parse(due);
        if (!Number.isNaN(dueTime)) {
          if (dueTime < now) {
            overdue += 1;
          } else if (dueTime <= soonThreshold) {
            dueSoon += 1;
          }
        }
      }
    }

    return {
      total: selectedDocuments.length,
      overdue,
      dueSoon,
      completed,
      pending: Math.max(selectedDocuments.length - completed, 0),
    };
  }, [selectedDocuments]);

  const segments = useMemo(
    () => [
      { label: 'All', value: 'all' as const, count: roleStats.total },
      { label: 'Overdue', value: 'overdue' as const, count: roleStats.overdue },
      { label: 'Due soon', value: 'due-soon' as const, count: roleStats.dueSoon },
      { label: 'Completed', value: 'completed' as const, count: roleStats.completed },
    ],
    [roleStats],
  );

  const docTypeOptions = useMemo(() => {
    const set = new Set<string>();
    selectedDocuments.forEach((doc) => {
      const type = doc.doc_type?.toLowerCase();
      if (type) {
        set.add(type);
      }
    });
    return Array.from(set).sort();
  }, [selectedDocuments]);

  const handleClearFilters = () => {
    setSearchValue('');
    setActiveSegment('all');
    setSortOption('due-soon');
    setSelectedDocTypes(new Set());
    setIsFilterPanelOpen(false);
    setSearchParams((params) => {
      params.delete('q');
      return params;
    });
  };

  const toggleDocType = (type: string) => {
    setSelectedDocTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const filteredDocuments = useMemo(() => {
    const now = Date.now();
    const soonThreshold = now + 48 * 60 * 60 * 1000;

    const matchesSegment = (doc: DocumentEntry) => {
      if (activeSegment === 'all') return true;
      const due = inferDueDate(doc);
      const dueTime = due ? Date.parse(due) : Number.NaN;
      const statusLower = inferStatus(doc).toLowerCase();

      if (activeSegment === 'completed') {
        return statusLower === 'completed';
      }
      if (activeSegment === 'overdue') {
        return !Number.isNaN(dueTime) && dueTime < now;
      }
      if (activeSegment === 'due-soon') {
        return !Number.isNaN(dueTime) && dueTime >= now && dueTime <= soonThreshold;
      }
      return true;
    };

    const base = activeSegment === 'all' ? selectedDocuments : selectedDocuments.filter(matchesSegment);

    const filteredByDocType = selectedDocTypes.size
      ? base.filter((doc) => {
          const type = doc.doc_type?.toLowerCase();
          return type ? selectedDocTypes.has(type) : false;
        })
      : base;

    const sorted = [...filteredByDocType].sort((a, b) => {
      if (sortOption === 'recent-upload') {
        const aTime = Date.parse(a.uploaded_at ?? '') || 0;
        const bTime = Date.parse(b.uploaded_at ?? '') || 0;
        return bTime - aTime;
      }
      if (sortOption === 'status') {
        return inferStatus(a).localeCompare(inferStatus(b));
      }
      // due soon (default)
      const aDue = Date.parse(inferDueDate(a) ?? '') || Number.MAX_SAFE_INTEGER;
      const bDue = Date.parse(inferDueDate(b) ?? '') || Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    });

    if (!searchValue.trim()) return sorted;
    const query = searchValue.trim().toLowerCase();
    return sorted.filter((doc) => {
      const haystack = [
        doc.filename,
        doc.doc_type,
        doc.document_id,
        inferStatus(doc),
        inferRole(doc),
        JSON.stringify(doc.metadata ?? {}),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [selectedDocuments, activeSegment, searchValue, sortOption, selectedDocTypes]);

  const handleRoleChange = (role: RoleKey) => {
    setSearchParams((params) => {
      params.set('role', role);
      return params;
    });
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSearchParams((params) => {
      if (searchValue.trim()) {
        params.set('q', searchValue.trim());
      } else {
        params.delete('q');
      }
      if (!params.get('role')) {
        params.set('role', selectedRole);
      }
      return params;
    });
  };

  return (
    <div className="bg-surface-subtle px-2 pb-6 pt-2 sm:px-4 lg:px-6 xl:px-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Workflow routing</p>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Work queues</h1>
          </div>
          <span className="text-sm text-muted-foreground">Viewing {selectedRole} · {roleStats.total} items</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={isFilterPanelOpen ? 'default' : 'outline'}
              size="sm"
              className="gap-2"
              onClick={() => setIsFilterPanelOpen((prev) => !prev)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() =>
                setSortOption((prev) =>
                  prev === 'due-soon' ? 'recent-upload' : prev === 'recent-upload' ? 'status' : 'due-soon',
                )
              }
            >
              <Clock className="h-4 w-4" />
              Sort: {sortOption === 'due-soon' ? 'Due date' : sortOption === 'recent-upload' ? 'Recent upload' : 'Status'}
            </Button>
          </div>
          <div className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-white p-1">
            <Button
              type="button"
              size="icon"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
              className="h-8 w-8"
            >
              <ListChecks className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              className="h-8 w-8"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr),minmax(0,0.9fr)]">
          <div className="flex flex-col gap-6">
            <Card className="overflow-hidden rounded-3xl border border-platinum-600 bg-white shadow-[0_18px_48px_rgba(112,99,244,0.08)]">
              <div className="flex flex-col">
                <div className="flex flex-col gap-4 border-b border-border/60 px-5 py-5">
                  <div className="flex flex-wrap items-center gap-2">
                    {ROLE_ORDER.map((role) => (
                      <Button
                        key={role}
                        variant={role === selectedRole ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => handleRoleChange(role)}
                        className="capitalize"
                      >
                        {role}
                        <CountBubble
                          count={columns.find((column) => column.role === role)?.documents.length ?? 0}
                          highlight={role === selectedRole}
                        />
                      </Button>
                    ))}
                  </div>
                  <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-2">
                    <div className="group flex flex-1 items-center gap-2 rounded-full border border-border/60 bg-white/90 px-4 py-2 shadow-sm focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20">
                      <Filter className="h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <Input
                        value={searchValue}
                        onChange={(event) => setSearchValue(event.target.value)}
                        placeholder="Search by filename, status, or metadata"
                        className="flex-1 border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
                      />
                    </div>
                    <Button type="submit" variant="default" className="rounded-full px-4">
                      Apply
                    </Button>
                  </form>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      {segments.map((segment) => (
                        <Button
                          key={segment.value}
                          type="button"
                          variant={activeSegment === segment.value ? 'default' : 'ghost'}
                          size="sm"
                          className="rounded-full"
                          onClick={() => setActiveSegment(segment.value)}
                        >
                          {segment.label}
                          <CountBubble count={segment.count} highlight={activeSegment === segment.value} />
                        </Button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Sort mode: {sortOption === 'due-soon' ? 'Due date' : sortOption === 'recent-upload' ? 'Recent upload' : 'Status'}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={handleClearFilters}>
                        Clear filters
                      </Button>
                    </div>
                  </div>
                  {isFilterPanelOpen && docTypeOptions.length ? (
                    <div className="rounded-2xl border border-dashed border-border/60 bg-white/70 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Document type</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {docTypeOptions.map((type) => {
                          const label = type
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, (char) => char.toUpperCase());
                          const checked = selectedDocTypes.has(type);
                          return (
                            <label key={type} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleDocType(type)}
                                className="h-4 w-4 rounded border-border/60"
                              />
                              <span className={checked ? 'font-medium text-foreground' : undefined}>{label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  {isLoading ? <p className="text-sm text-muted-foreground">Loading queues…</p> : null}
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                </div>
                <div>
                  {viewMode === 'list' ? <QueueTableHeader /> : null}
                  {filteredDocuments.length === 0 ? (
                    <div className="flex items-center justify-between gap-3 px-5 py-6 text-sm text-muted-foreground">
                      <span>No documents in this queue yet.</span>
                      <Button asChild variant="outline" size="sm">
                        <Link to="/">Upload a document</Link>
                      </Button>
                    </div>
                  ) : viewMode === 'grid' ? (
                    <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
                      {filteredDocuments.map((doc) => (
                        <QueueRow key={doc.document_id} document={doc} viewMode={viewMode} />
                      ))}
                    </div>
                  ) : (
                    filteredDocuments.map((doc, index) => (
                      <QueueRow key={doc.document_id} document={doc} viewMode={viewMode} isFirst={index === 0} />
                    ))
                  )}
                </div>
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            <QueueInsightsCard role={selectedRole} stats={roleStats} />
            <RoleLoadCard columns={columns} activeRole={selectedRole} />
            <QueueQuickActionsCard />
          </div>
        </div>
      </div>
    </div>
  );
}

function QueueRow({ document, viewMode, isFirst = false }: { document: DocumentEntry; viewMode: 'list' | 'grid'; isFirst?: boolean }) {
  const status = inferStatus(document);
  const dueDateRaw = inferDueDate(document);
  const dueAt = dueDateRaw ? formatDateTime(dueDateRaw) : 'No SLA date';
  const role = inferRole(document);
  const uploadedAt = formatDateTime(document.uploaded_at);
  const isComplete = status.toLowerCase() === 'completed';
  const dueTime = dueDateRaw ? Date.parse(dueDateRaw) : Number.NaN;
  const now = Date.now();
  const isOverdue = !Number.isNaN(dueTime) && dueTime < now;
  const isDueSoon = !Number.isNaN(dueTime) && dueTime >= now && dueTime <= now + 48 * 60 * 60 * 1000;

  const statusTone = status.toLowerCase();
  const statusStyles: Record<string, string> = {
    completed: 'border-emerald-300 bg-emerald-50 text-emerald-700',
    'ready for review': 'border-sky-300 bg-sky-50 text-sky-700',
    processing: 'border-blue-300 bg-blue-50 text-blue-700',
    'in progress': 'border-blue-300 bg-blue-50 text-blue-700',
    pending: 'border-amber-300 bg-amber-50 text-amber-700',
  };
  const statusClass = statusStyles[statusTone] ?? 'border-slate-300 bg-slate-100 text-slate-700';

  const dueClass = isOverdue
    ? 'border-destructive/50 bg-destructive/10 text-destructive'
    : isDueSoon
      ? 'border-amber-400 bg-amber-50 text-amber-700'
      : dueDateRaw
        ? 'border-sky-200 bg-sky-50 text-sky-700'
        : 'border-slate-300 bg-slate-100 text-muted-foreground';

  const ownerName = ((document.metadata as Record<string, unknown>)?.owner_name as string) ?? role;
  const ownerInitials = ownerName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || role.slice(0, 2).toUpperCase();

  if (viewMode === 'grid') {
    return (
      <Card className="flex flex-col gap-3 border border-border/60 bg-white px-4 py-4 shadow-sm transition hover:border-primary/40">
        <CardTitle className="text-sm font-semibold text-foreground">
          {document.filename ?? document.document_id}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">{document.doc_type ?? 'Uncategorised'}</span> · Uploaded {uploadedAt}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]">
          <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${statusClass}`}>
            <CheckCircle2 className="h-2.5 w-2.5" />
            {status}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${dueClass}`}>
            <Clock className="h-2.5 w-2.5" />
            {dueAt}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {ownerInitials}
          </span>
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">{ownerName}</p>
            <p className="text-xs text-muted-foreground">{role}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm">
            Reassign
          </Button>
          <Button asChild variant="default" size="sm" disabled={isComplete}>
            <Link to={`/pipeline?document=${document.document_id}`} className="inline-flex items-center gap-1">
              Open
              <MoveRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div
      className={cn(
        'grid gap-3 border-t border-border/60 px-4 py-4 sm:grid-cols-[minmax(0,2.4fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,0.8fr)] sm:items-center',
        isFirst && 'border-t-0',
      )}
    >
      <div className="col-span-full space-y-1 sm:col-span-1">
          <CardTitle className="text-sm font-semibold text-foreground">
            {document.filename ?? document.document_id}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">{document.doc_type ?? 'Uncategorised'}</span> · Uploaded {uploadedAt}
          </p>
      </div>
      <div className="col-span-full flex flex-wrap items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] sm:col-span-1">
          <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${statusClass}`}>
            <CheckCircle2 className="h-2.5 w-2.5" />
            {status}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${dueClass}`}>
            <Clock className="h-2.5 w-2.5" />
            {dueAt}
          </span>
      </div>
      <div className="col-span-full flex items-center gap-3 sm:col-span-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {ownerInitials}
          </span>
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">{ownerName}</p>
            <p className="text-xs text-muted-foreground">{role}</p>
          </div>
      </div>
      <div className="col-span-full flex items-center justify-end gap-2 sm:col-span-1">
          <Button variant="outline" size="sm">
            Reassign
          </Button>
          <Button asChild variant="default" size="sm" disabled={isComplete}>
            <Link to={`/pipeline?document=${document.document_id}`} className="inline-flex items-center gap-1">
              Open
              <MoveRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
      </div>
    </div>
  );
}

function QueueTableHeader() {
  return (
    <div className="hidden border-b border-border/60 bg-white px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:grid sm:grid-cols-[minmax(0,2.4fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,0.8fr)] sm:items-center">
      <span className="text-left">Name</span>
      <span className="text-left">SLA</span>
      <span className="text-left">Owner</span>
      <span className="text-right">Actions</span>
    </div>
  );
}

function QueueInsightsCard({ role, stats }: { role: RoleKey; stats: QueueRoleStats }) {
  const metrics = [
    {
      label: 'In queue',
      value: stats.total.toLocaleString(),
      helper: `${stats.pending.toLocaleString()} active` ,
      icon: FolderOpen,
    },
    {
      label: 'Overdue',
      value: stats.overdue.toLocaleString(),
      helper: 'Past due date',
      icon: AlertTriangle,
    },
    {
      label: 'Due soon',
      value: stats.dueSoon.toLocaleString(),
      helper: 'Within 48 hours',
      icon: Clock,
    },
    {
      label: 'Completed',
      value: stats.completed.toLocaleString(),
      helper: 'Marked complete',
      icon: CheckCircle2,
    },
  ];

  return (
    <Card className="shadow-none border border-platinum-600 bg-white">
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">Queue insights</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Snapshot for {role}</CardDescription>
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {stats.total} items
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {metrics.map(({ label, value, helper, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 rounded-lg border border-border/60 bg-white px-3 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{helper}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RoleLoadCard({ columns, activeRole }: { columns: QueueColumn[]; activeRole: RoleKey }) {
  const total = columns.reduce((acc, column) => acc + column.documents.length, 0);

  return (
    <Card className="shadow-none border border-platinum-600 bg-white">
      <CardContent className="flex flex-col gap-4 p-4">
        <div>
          <CardTitle className="text-sm font-semibold text-foreground">Workload by role</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">Distribution across routing teams.</CardDescription>
        </div>
        <div className="space-y-3">
          {columns.map(({ role, documents }) => {
            const count = documents.length;
            const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={role} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className={role === activeRole ? 'font-semibold text-foreground' : undefined}>{role}</span>
                  <span className="font-medium text-foreground">{count.toLocaleString()} ({percentage}%)</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#2f6690] to-[#81c3d7]"
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function QueueQuickActionsCard() {
  const actions = [
    {
      title: 'Review overdue items',
      description: 'Prioritise documents that have slipped past their SLA.',
      icon: AlertTriangle,
    },
    {
      title: 'Balance workload',
      description: 'Reassign items from busy teams to free capacity.',
      icon: Users,
    },
  ];

  return (
    <Card className="shadow-none border border-platinum-600 bg-white">
      <CardContent className="flex flex-col gap-3 p-4">
        <div>
          <CardTitle className="text-sm font-semibold text-foreground">Queue actions</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">Suggested next steps for operations leads.</CardDescription>
        </div>
        <div className="space-y-3">
          {actions.map(({ title, description, icon: Icon }) => (
            <div key={title} className="flex items-start gap-3 rounded-lg border border-border/60 bg-white px-3 py-3">
              <Icon className="mt-0.5 h-4 w-4 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CountBubble({ count, highlight }: { count: number; highlight?: boolean }) {
  return (
    <span
      className={cn(
        'ml-2 inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded-full px-1 text-[11px] font-semibold transition-colors',
        highlight ? 'bg-white/90 text-primary' : 'bg-lapis-500/10 text-lapis-500',
      )}
    >
      {count}
    </span>
  );
}
