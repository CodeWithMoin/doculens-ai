import { Link } from 'react-router-dom';
import { ScanText } from 'lucide-react';

import { cn } from '../../lib/utils';

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link to="/" className={cn('group inline-flex items-center gap-2.5 text-foreground no-underline', className)} aria-label="DocuLens home">
      <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-foreground text-background shadow-sm transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105">
        <ScanText className="h-[17px] w-[17px]" strokeWidth={2.2} />
      </span>
      {!compact ? (
        <span className="text-[15px] font-semibold tracking-[-0.025em]">
          DocuLens <span className="text-muted-foreground">AI</span>
        </span>
      ) : null}
    </Link>
  );
}
