import { type ComponentType, Suspense, lazy } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface TimeSeriesCardProps {
  title: string;
  icon?: ComponentType<{ className?: string }>;
  data: Array<{ label: string; value: number }>;
  color?: string;
  helper?: string;
}

const LazyChart = lazy(() => import('./TimeSeriesChartInner'));

export function TimeSeriesCard({ title, icon: Icon, data, color = '#2563eb', helper }: TimeSeriesCardProps) {
  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
        {Icon ? <Icon className="h-5 w-5 text-primary" /> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-[180px] w-full">
          <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-muted-foreground">Loading chart…</div>}>
            <LazyChart data={data} color={color} />
          </Suspense>
        </div>
        {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
      </CardContent>
    </Card>
  );
}
