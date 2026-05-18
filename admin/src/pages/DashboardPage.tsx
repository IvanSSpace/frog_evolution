import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Mock data — Phase 30 will replace with real API data
const MOCK_SIGNUPS = [
  { date: 'May 13', signups: 12 },
  { date: 'May 14', signups: 18 },
  { date: 'May 15', signups: 9 },
  { date: 'May 16', signups: 24 },
  { date: 'May 17', signups: 31 },
  { date: 'May 18', signups: 27 },
  { date: 'May 19', signups: 15 },
]

export function DashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-foreground">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-foreground">—</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">DAU</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-foreground">—</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Banned Users</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-foreground">—</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Signups / Day (mock data)</CardTitle>
          <p className="text-xs text-muted-foreground">Real analytics — Phase 30</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={MOCK_SIGNUPS}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                }}
              />
              <Line
                type="monotone"
                dataKey="signups"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
