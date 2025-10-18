import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';

import { useAuth } from '../../auth/useAuth';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

export function ProfileMenu() {
  const { user, logout, roles } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickAway = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickAway);
    return () => document.removeEventListener('mousedown', handleClickAway);
  }, [isOpen]);

  if (!user) {
    return null;
  }

  const roleDefinition = roles[user.role] ?? roles[user.role.toLowerCase()];

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className={cn(
          'flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-sm font-medium text-foreground shadow-subtle transition hover:border-primary/40',
          isOpen ? 'border-primary/40' : '',
        )}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold uppercase text-primary">
          {user.full_name
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)}
        </span>
        <div className="hidden text-left leading-none md:block">
          <p className="text-xs font-semibold text-foreground">{user.full_name}</p>
          <p className="text-[11px] capitalize text-muted-foreground">{user.role}</p>
        </div>
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition', isOpen ? 'rotate-180' : '')} />
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-12 z-50 w-64 rounded-xl border border-border/60 bg-card/95 p-3 text-sm shadow-xl shadow-black/10">
          <div className="space-y-1 border-b border-border/60 pb-3">
            <p className="text-sm font-semibold text-foreground">{user.full_name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          {roleDefinition ? (
            <div className="space-y-2 border-b border-border/60 py-3 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">{roleDefinition.label}</span>
                <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {roleDefinition.access_level}
                </span>
              </div>
              <p>{roleDefinition.description}</p>
              <p className="text-[11px]">{roleDefinition.permissions}</p>
            </div>
          ) : null}
          <div className="pt-3">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-sm text-destructive"
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
