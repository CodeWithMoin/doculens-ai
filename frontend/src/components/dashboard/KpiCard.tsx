import { type ComponentType } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../../lib/utils';

interface KpiCardProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta?: string;
  tone?: 'positive' | 'negative' | 'neutral';
  helper?: string;
}

const toneClasses: Record<NonNullable<KpiCardProps['tone']>, string> = {
  positive: 'text-emerald-500',
  negative: 'text-destructive',
  neutral: 'text-muted-foreground',
};

export function KpiCard({ icon: Icon, label, value, delta, tone = 'neutral', helper }: KpiCardProps) {
  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-semibold text-foreground">{value}</div>
        {delta ? <div className={cn('text-xs font-medium', toneClasses[tone])}>{delta}</div> : null}
        {helper ? <CardDescription>{helper}</CardDescription> : null}
      </CardContent>
    </Card>
  );
}
