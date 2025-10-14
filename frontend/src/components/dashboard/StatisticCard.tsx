import { type ComponentType, type ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface StatisticCardProps {
  title: string;
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
}

export function StatisticCard({ title, icon: Icon, children }: StatisticCardProps) {
  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        {Icon ? <Icon className="h-5 w-5 text-primary" /> : null}
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">{children}</CardContent>
    </Card>
  );
}
