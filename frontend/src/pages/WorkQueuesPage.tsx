import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Filter,
  Info,
  LayoutGrid,
  ListChecks,
  MoveRight,
  SlidersHorizontal,
} from 'lucide-react';

import { fetchDocuments } from '../api/client';
import type { DocumentEntry } from '../api/types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
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

type SummaryTone = 'neutral' | 'warning' | 'critical' | 'success';

const PREF_KEYS = {
  viewMode: 'doculens_queue_view_mode',
  activeSegment: 'doculens_queue_segment',
  sortOption: 'doculens_queue_sort',
  detailsVisible: 'doculens_queue_details',
};

function loadPreference<T>(key: string, fallback: T, validator: (value: unknown) => value is T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) {
      return fallback;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (validator(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.warn(`Failed to load preference for ${key}`, error);
  }
  return fallback;
}

function savePreference(key: string, value: unknown) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to persist preference for ${key}`, error);
  }
}

export function WorkQueuesPage() {
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get('q') ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() =>
    loadPreference(PREF_KEYS.viewMode, 'list', (value): value is 'list' | 'grid' => value === 'list' || value === 'grid'),
  );
  const [activeSegment, setActiveSegment] = useState<'all' | 'overdue' | 'due-soon' | 'completed'>(() =>
    loadPreference(
      PREF_KEYS.activeSegment,
      'all',
      (value): value is 'all' | 'overdue' | 'due-soon' | 'completed' =>
        value === 'all' || value === 'overdue' || value === 'due-soon' || value === 'completed',
    ),
  );
  const [sortOption, setSortOption] = useState<'due-soon' | 'recent-upload' | 'status'>(() =>
    loadPreference(
      PREF_KEYS.sortOption,
      'due-soon',
      (value): value is 'due-soon' | 'recent-upload' | 'status' =>
        value === 'due-soon' || value === 'recent-upload' || value === 'status',
    ),
  );
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [selectedDocTypes, setSelectedDocTypes] = useState<Set<string>>(new Set());
  const [urgencyFilter, setUrgencyFilter] = useState<'any' | 'overdue' | 'due-soon' | 'future' | 'no-sla'>('any');
  const [isDetailsVisible, setIsDetailsVisible] = useState<boolean>(() =>
    loadPreference(PREF_KEYS.detailsVisible, false, (value): value is boolean => typeof value === 'boolean'),
  );
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [reassigningDocumentId, setReassigningDocumentId] = useState<string | null>(null);
  const [pendingReassignRole, setPendingReassignRole] = useState<RoleKey>(ROLE_ORDER[0]);

  const selectedRole = (searchParams.get('role') as RoleKey | null) ?? 'Finance';

  useEffect(() => {
    savePreference(PREF_KEYS.viewMode, viewMode);
  }, [viewMode]);

  useEffect(() => {
    savePreference(PREF_KEYS.activeSegment, activeSegment);
  }, [activeSegment]);

  useEffect(() => {
    savePreference(PREF_KEYS.sortOption, sortOption);
  }, [sortOption]);

  useEffect(() => {
    savePreference(PREF_KEYS.detailsVisible, isDetailsVisible);
  }, [isDetailsVisible]);

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

  const urgencyOptions: Array<{ value: typeof urgencyFilter; label: string; helper: string }> = [
    { value: 'any', label: 'All urgencies', helper: 'Show every item regardless of due date.' },
    { value: 'overdue', label: 'Overdue', helper: 'Due date has passed.' },
    { value: 'due-soon', label: 'Due soon', helper: 'Due within the next 48 hours.' },
    { value: 'future', label: 'Scheduled', helper: 'Due date is more than 48 hours away.' },
    { value: 'no-sla', label: 'No SLA date', helper: 'No due date detected in metadata.' },
  ];

  const handleClearFilters = () => {
    setSearchValue('');
    setActiveSegment('all');
    setSortOption('due-soon');
    setSelectedDocTypes(new Set());
    setUrgencyFilter('any');
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

    const filteredByUrgency =
      urgencyFilter === 'any'
        ? filteredByDocType
        : filteredByDocType.filter((doc) => {
            const due = inferDueDate(doc);
            if (!due) {
              return urgencyFilter === 'no-sla';
            }
            const dueTime = Date.parse(due);
            if (Number.isNaN(dueTime)) {
              return urgencyFilter === 'no-sla';
            }
            if (urgencyFilter === 'overdue') {
              return dueTime < now;
            }
            if (urgencyFilter === 'due-soon') {
              return dueTime >= now && dueTime <= soonThreshold;
            }
            if (urgencyFilter === 'future') {
              return dueTime > soonThreshold;
            }
            return true;
          });

    const sorted = [...filteredByUrgency].sort((a, b) => {
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
  }, [selectedDocuments, activeSegment, searchValue, sortOption, selectedDocTypes, urgencyFilter]);

  const selectedDocument = useMemo(
    () => filteredDocuments.find((doc) => doc.document_id === selectedDocumentId) ?? null,
    [filteredDocuments, selectedDocumentId],
  );

  const hasActiveFilters =
    activeSegment !== 'all' ||
    searchValue.trim() !== '' ||
    selectedDocTypes.size > 0 ||
    sortOption !== 'due-soon' ||
    urgencyFilter !== 'any';
  const activeFiltersCount =
    (activeSegment !== 'all' ? 1 : 0) +
    (searchValue.trim() !== '' ? 1 : 0) +
    (selectedDocTypes.size > 0 ? 1 : 0) +
    (sortOption !== 'due-soon' ? 1 : 0) +
    (urgencyFilter !== 'any' ? 1 : 0);
  const filtersSummary = hasActiveFilters
    ? `${activeFiltersCount} active filter${activeFiltersCount === 1 ? '' : 's'}`
    : 'No filters applied';

  useEffect(() => {
    if (filteredDocuments.length === 0) {
      setSelectedDocumentId(null);
      setReassigningDocumentId(null);
      setPendingReassignRole(ROLE_ORDER[0]);
      return;
    }
    if (!selectedDocument) {
      const firstDoc = filteredDocuments[0];
      setSelectedDocumentId(firstDoc.document_id);
      setPendingReassignRole(inferRole(firstDoc));
      setReassigningDocumentId(null);
    }
  }, [filteredDocuments, selectedDocument]);

  const handleSelectDocument = (docId: string) => {
    setSelectedDocumentId(docId);
    setReassigningDocumentId((current) => (current === docId ? current : null));
    const doc = documents.find((entry) => entry.document_id === docId);
    if (doc) {
      setPendingReassignRole(inferRole(doc));
    }
  };

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

  const handleRequestReassign = (doc: DocumentEntry) => {
    handleSelectDocument(doc.document_id);
    setIsDetailsVisible(true);
    setReassigningDocumentId(doc.document_id);
    setPendingReassignRole(inferRole(doc));
  };

  const handleCancelReassign = () => {
    if (selectedDocument) {
      setPendingReassignRole(inferRole(selectedDocument));
    } else {
      setPendingReassignRole(ROLE_ORDER[0]);
    }
    setReassigningDocumentId(null);
  };

  const handleConfirmReassign = () => {
    if (!reassigningDocumentId) return;
    const targetDoc = documents.find((doc) => doc.document_id === reassigningDocumentId);
    if (!targetDoc) {
      setReassigningDocumentId(null);
      return;
    }
    const nextRole = pendingReassignRole;
    const currentRole = inferRole(targetDoc);
    if (nextRole === currentRole) {
      setReassigningDocumentId(null);
      return;
    }

    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.document_id !== reassigningDocumentId) {
          return doc;
        }
        const updatedMetadata = { ...(doc.metadata ?? {}), assigned_role: nextRole };
        return {
          ...doc,
          assigned_role: nextRole,
          metadata: updatedMetadata,
        };
      }),
    );

    setReassigningDocumentId(null);
    setPendingReassignRole(nextRole);
    if (selectedRole !== nextRole) {
      handleRoleChange(nextRole);
    }
    setSelectedDocumentId(targetDoc.document_id);
    setIsDetailsVisible(true);
  };

  const showDetailsPanel = isDetailsVisible && !!selectedDocument;
  const detailStatusClass = selectedDocument ? getStatusClass(inferStatus(selectedDocument)) : '';
  const detailDueRaw = selectedDocument ? inferDueDate(selectedDocument) : null;
  const detailDueClass = getDueClass(detailDueRaw ?? undefined);
  const detailDueLabel = detailDueRaw ? formatDateTime(detailDueRaw) : 'No SLA date';
  const detailOwnerName = selectedDocument ? getOwnerName(selectedDocument, inferRole(selectedDocument)) : '';
  const detailOwnerInitials = selectedDocument ? getOwnerInitials(selectedDocument, inferRole(selectedDocument)) : '';
  const selectedDocumentRole = selectedDocument ? inferRole(selectedDocument) : 'Unassigned';

  return (
    <div className="bg-surface-subtle px-2 pb-0 pt-2 sm:px-4 lg:px-6 xl:px-4">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Workflow routing</p>
          <div className="flex flex-col gap-2 text-foreground sm:flex-row sm:items-end sm:justify-between">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Work queues</h1>
            <span className="text-sm text-muted-foreground">Viewing {selectedRole} · {roleStats.total} items</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-3xl border border-border/60 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {selectedRole} queue snapshot
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>
                Showing {filteredDocuments.length.toLocaleString()} of {selectedDocuments.length.toLocaleString()} items
              </span>
              <Badge
                variant={hasActiveFilters ? 'accent' : 'muted'}
                className={cn('rounded-full px-2 py-0 text-[11px] uppercase tracking-[0.14em]', !hasActiveFilters && 'text-muted-foreground')}
              >
                {filtersSummary}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <QueueSummaryPill label="In queue" value={roleStats.total} />
            <QueueSummaryPill label="Active" value={roleStats.pending} />
            <QueueSummaryPill label="Due soon" value={roleStats.dueSoon} tone="warning" />
            <QueueSummaryPill label="Overdue" value={roleStats.overdue} tone="critical" />
            <QueueSummaryPill label="Completed" value={roleStats.completed} tone="success" />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={isFilterPanelOpen ? 'default' : 'outline'}
              size="sm"
              className="gap-2"
              onClick={() => setIsFilterPanelOpen((prev) => !prev)}
              aria-expanded={isFilterPanelOpen}
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
              aria-label="Change sort order"
            >
              <Clock className="h-4 w-4" />
              Sort: {sortOption === 'due-soon' ? 'Due date' : sortOption === 'recent-upload' ? 'Recent upload' : 'Status'}
            </Button>
            {hasActiveFilters ? (
              <Button type="button" variant="ghost" size="sm" onClick={handleClearFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
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
            <div className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-white p-1">
              <Button
                type="button"
                size="icon"
                variant={showDetailsPanel ? 'default' : 'ghost'}
                onClick={() => setIsDetailsVisible((prev) => !prev)}
                aria-pressed={showDetailsPanel ? 'true' : 'false'}
                className="h-8 w-8"
                disabled={filteredDocuments.length === 0}
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className={cn('grid gap-6', showDetailsPanel ? 'lg:grid-cols-[minmax(0,1.45fr),minmax(0,0.8fr)]' : '')}>
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
                        className="rounded-full capitalize"
                        aria-pressed={role === selectedRole}
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
                        aria-label="Search queue"
                        className="flex-1 border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
                      />
                    </div>
                    <Button type="submit" variant="default" className="rounded-full px-4">
                      Apply
                    </Button>
                  </form>
                  <div className="flex flex-wrap items-center gap-2">
                    {segments.map((segment) => (
                      <Button
                        key={segment.value}
                        type="button"
                        variant={activeSegment === segment.value ? 'default' : 'ghost'}
                        size="sm"
                        className="rounded-full"
                        onClick={() => setActiveSegment(segment.value)}
                        aria-pressed={activeSegment === segment.value}
                      >
                        {segment.label}
                        <CountBubble count={segment.count} highlight={activeSegment === segment.value} />
                      </Button>
                    ))}
                  </div>
                  {isFilterPanelOpen ? (
                    <div className="rounded-2xl border border-dashed border-border/60 bg-white/70 px-4 py-4 space-y-5">
                      {docTypeOptions.length ? (
                        <div>
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
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Urgency</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {urgencyOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setUrgencyFilter(option.value)}
                              className={cn(
                                'flex flex-col gap-1 rounded-xl border px-3 py-2 text-left transition-colors',
                                urgencyFilter === option.value
                                  ? 'border-primary/50 bg-primary/10 text-primary'
                                  : 'border-border/60 bg-white text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary',
                              )}
                              aria-pressed={urgencyFilter === option.value}
                            >
                              <span className="text-sm font-medium">{option.label}</span>
                              <span className="text-xs text-muted-foreground/80">{option.helper}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {isLoading ? <p className="text-sm text-muted-foreground">Loading queues…</p> : null}
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                </div>
                <div>
                  {viewMode === 'list' ? <QueueTableHeader /> : null}
                  {filteredDocuments.length === 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-6">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          {hasActiveFilters ? 'No items match your filters.' : 'No documents in this queue yet.'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {hasActiveFilters
                            ? 'Try adjusting the filters or sort order to widen the results.'
                            : 'Upload a new document or pick a different team to start routing.'}
                        </p>
                      </div>
                      {hasActiveFilters ? (
                        <Button type="button" variant="outline" size="sm" onClick={handleClearFilters}>
                          Clear filters
                        </Button>
                      ) : (
                        <Button asChild variant="outline" size="sm">
                          <Link to="/">Upload a document</Link>
                        </Button>
                      )}
                    </div>
                  ) : viewMode === 'grid' ? (
                    <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
                      {filteredDocuments.map((doc) => (
                      <QueueRow
                        key={doc.document_id}
                        document={doc}
                        viewMode={viewMode}
                        isSelected={selectedDocumentId === doc.document_id}
                        onSelect={handleSelectDocument}
                        onRequestReassign={handleRequestReassign}
                      />
                    ))}
                  </div>
                ) : (
                  filteredDocuments.map((doc, index) => (
                      <QueueRow
                        key={doc.document_id}
                        document={doc}
                        viewMode={viewMode}
                        isFirst={index === 0}
                        isSelected={selectedDocumentId === doc.document_id}
                        onSelect={handleSelectDocument}
                        onRequestReassign={handleRequestReassign}
                      />
                    ))
                  )}
                </div>
              </div>
            </Card>
          </div>

          {showDetailsPanel && selectedDocument ? (
            <aside className="hidden flex-col gap-4 lg:flex">
              <Card className="rounded-3xl border border-platinum-600 bg-white shadow-[0_18px_48px_rgba(112,99,244,0.08)]">
                <CardContent className="flex flex-col gap-4 p-5 text-sm text-muted-foreground">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-semibold text-foreground">
                      {selectedDocument.filename ?? selectedDocument.document_id}
                    </CardTitle>
                    <CardDescription>
                      {(selectedDocument.doc_type ?? 'Uncategorised') + ' · Uploaded ' + formatDateTime(selectedDocument.uploaded_at)}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${detailStatusClass}`}>
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      {selectedDocument ? inferStatus(selectedDocument) : ''}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${detailDueClass}`}>
                      <Clock className="h-2.5 w-2.5" />
                      {detailDueLabel}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Owner</p>
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {detailOwnerInitials}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{detailOwnerName}</p>
                        <p className="text-xs text-muted-foreground">{selectedDocument ? inferRole(selectedDocument) : ''}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Document ID</p>
                    <p className="rounded-lg border border-dashed border-border/60 bg-white px-3 py-2 font-mono text-xs text-foreground">
                      {selectedDocument.document_id}
                    </p>
                  </div>
                  {selectedDocument ? (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Actions</p>
                      {reassigningDocumentId === selectedDocument.document_id ? (
                        <div className="space-y-3 rounded-2xl border border-dashed border-border/60 bg-white/70 px-4 py-4">
                          <div className="space-y-2">
                            <Label
                              htmlFor={`reassign-role-${selectedDocument.document_id}`}
                              className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                            >
                              Assign to
                            </Label>
                            <select
                              id={`reassign-role-${selectedDocument.document_id}`}
                              className="w-full rounded-lg border border-border/60 bg-white px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                              value={pendingReassignRole}
                              onChange={(event) => setPendingReassignRole(event.target.value as RoleKey)}
                            >
                              {ROLE_ORDER.map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <Button type="button" variant="ghost" size="sm" onClick={handleCancelReassign}>
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleConfirmReassign}
                              disabled={pendingReassignRole === selectedDocumentRole}
                            >
                              Confirm
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button type="button" variant="outline" size="sm" onClick={() => handleRequestReassign(selectedDocument)}>
                          Reassign document
                        </Button>
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function QueueSummaryPill({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: SummaryTone }) {
  const palette: Record<SummaryTone, string> = {
    neutral: 'border-border/60 bg-muted text-foreground',
    warning: 'border-amber-300 bg-amber-50 text-amber-900',
    critical: 'border-destructive/40 bg-destructive/10 text-destructive',
    success: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  };
  const labelPalette: Record<SummaryTone, string> = {
    neutral: 'text-muted-foreground',
    warning: 'text-amber-700',
    critical: 'text-destructive',
    success: 'text-emerald-700',
  };

  return (
    <div
      className={cn(
        'flex min-w-[6.5rem] flex-col rounded-2xl border px-3 py-2 text-left shadow-sm transition-colors',
        palette[tone],
      )}
    >
      <span className={cn('text-[10px] font-semibold uppercase tracking-[0.14em]', labelPalette[tone])}>
        {label}
      </span>
      <span className="text-base font-semibold tracking-tight">{value.toLocaleString()}</span>
    </div>
  );
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  completed: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  'ready for review': 'border-sky-300 bg-sky-50 text-sky-700',
  processing: 'border-blue-300 bg-blue-50 text-blue-700',
  'in progress': 'border-blue-300 bg-blue-50 text-blue-700',
  pending: 'border-amber-300 bg-amber-50 text-amber-700',
};

function getStatusClass(status: string): string {
  return STATUS_BADGE_STYLES[status.toLowerCase()] ?? 'border-slate-300 bg-slate-100 text-slate-700';
}

function getDueClass(dueDateRaw?: string | null): string {
  if (!dueDateRaw) {
    return 'border-slate-300 bg-slate-100 text-muted-foreground';
  }
  const dueTime = Date.parse(dueDateRaw);
  if (Number.isNaN(dueTime)) {
    return 'border-slate-300 bg-slate-100 text-muted-foreground';
  }
  const now = Date.now();
  if (dueTime < now) {
    return 'border-destructive/50 bg-destructive/10 text-destructive';
  }
  if (dueTime <= now + 48 * 60 * 60 * 1000) {
    return 'border-amber-400 bg-amber-50 text-amber-700';
  }
  return 'border-sky-200 bg-sky-50 text-sky-700';
}

function getOwnerName(document: DocumentEntry, fallbackRole: string): string {
  const metadata = (document.metadata as Record<string, unknown>) ?? {};
  return (metadata.owner_name as string) || (metadata.owner as string) || fallbackRole;
}

function getOwnerInitials(document: DocumentEntry, fallbackRole: string): string {
  const name = getOwnerName(document, fallbackRole);
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || fallbackRole.slice(0, 2).toUpperCase()
  );
}

function QueueRow({
  document,
  viewMode,
  isFirst = false,
  isSelected = false,
  onSelect,
  onRequestReassign,
}: {
  document: DocumentEntry;
  viewMode: 'list' | 'grid';
  isFirst?: boolean;
  isSelected?: boolean;
  onSelect: (id: string) => void;
  onRequestReassign: (doc: DocumentEntry) => void;
}) {
  const status = inferStatus(document);
  const dueDateRaw = inferDueDate(document);
  const dueAt = dueDateRaw ? formatDateTime(dueDateRaw) : 'No SLA date';
  const role = inferRole(document);
  const uploadedAt = formatDateTime(document.uploaded_at);
  const isComplete = status.toLowerCase() === 'completed';
  const statusClass = getStatusClass(status);
  const dueClass = getDueClass(dueDateRaw);
  const ownerName = getOwnerName(document, role);
  const ownerInitials = getOwnerInitials(document, role);

  if (viewMode === 'grid') {
    return (
      <Card
        onClick={() => onSelect(document.document_id)}
        className={cn(
          'flex cursor-pointer flex-col gap-3 border border-border/60 bg-white px-4 py-4 shadow-sm transition hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20',
          isSelected && 'border-primary/40 ring-2 ring-primary/20',
        )}
        tabIndex={0}
        role="button"
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect(document.document_id);
          }
        }}
      >
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
          <Button
            variant="outline"
            size="sm"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRequestReassign(document);
            }}
          >
            Reassign
          </Button>
          <Button asChild variant="default" size="sm" disabled={isComplete}>
            <Link
              to={`/pipeline?document=${document.document_id}`}
              className="inline-flex items-center gap-1 text-primary-foreground hover:text-primary-foreground"
            >
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
        'grid cursor-pointer gap-3 border-t border-border/60 px-4 py-4 hover:bg-primary/5 sm:grid-cols-[minmax(0,2.4fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,0.8fr)] sm:items-center',
        isFirst && 'border-t-0',
        isSelected && 'bg-primary/5 border-primary/40',
      )}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(document.document_id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(document.document_id);
        }
      }}
      aria-pressed={isSelected}
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
        <Button
          variant="outline"
          size="sm"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRequestReassign(document);
          }}
        >
          Reassign
        </Button>
        <Button asChild variant="default" size="sm" disabled={isComplete}>
          <Link
            to={`/pipeline?document=${document.document_id}`}
            className="inline-flex items-center gap-1 text-primary-foreground hover:text-primary-foreground"
          >
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
