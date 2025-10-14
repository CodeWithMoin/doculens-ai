import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface Props {
  data: Array<{ label: string; value: number }>;
  color: string;
}

export default function TimeSeriesChartInner({ data, color }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ left: -20, right: 0, top: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.35} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--docu-muted) / 0.6)" />
        <XAxis dataKey="label" stroke="hsl(var(--docu-muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="hsl(var(--docu-muted-foreground))" fontSize={12} tickLine={false} axisLine={false} width={35} />
        <Tooltip
          cursor={{ stroke: 'hsl(var(--docu-muted))' }}
          contentStyle={{ background: 'hsl(var(--docu-card))', borderRadius: 12, border: '1px solid hsl(var(--docu-border))' }}
        />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill="url(#chartGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
