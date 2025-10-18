import { type FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Lock, LogIn, Mail } from 'lucide-react';

import { useAuth } from '../auth/useAuth';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';

const DEMO_ACCOUNTS = [
  { email: 'admin@doculens.ai', role: 'Admin', password: 'Admin!234' },
  { email: 'analyst@doculens.ai', role: 'Analyst', password: 'Analyst!234' },
  { email: 'reviewer@doculens.ai', role: 'Reviewer', password: 'Reviewer!234' },
  { email: 'manager@doculens.ai', role: 'Manager', password: 'Manager!234' },
  { email: 'developer@doculens.ai', role: 'Developer', password: 'Developer!234' },
  { email: 'viewer@doculens.ai', role: 'Viewer', password: 'Viewer!234' },
];

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = (location.state as { from?: { pathname?: string } } | undefined)?.from;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      const redirectTo = fromState?.pathname ?? '/';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      console.error(err);
      setError('We could not sign you in with those credentials.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 px-4">
      <Card className="w-full max-w-3xl border-border/70 bg-card/95 shadow-xl shadow-black/10">
        <CardHeader className="flex flex-col gap-2">
          <CardTitle className="text-2xl font-semibold text-foreground">Sign in to DocuLens</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Secure access for analysts, reviewers, managers, and administrators.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-[1.1fr,0.9fr]">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground" htmlFor="email">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
              <LogIn className="h-4 w-4" />
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Role directory</p>
            <p className="mt-1 text-xs">
              Demo credentials for each persona are available below. Rotate passwords in production and manage accounts from the admin
              console.
            </p>
            <ul className="mt-3 space-y-2">
              {DEMO_ACCOUNTS.map((account) => (
                <li
                  key={account.email}
                  className="rounded-lg border border-dashed border-border/50 bg-card/70 px-3 py-2 text-xs text-muted-foreground"
                >
                  <div className="flex items-center justify-between gap-2 text-foreground">
                    <span className="font-semibold">{account.role}</span>
                    <Badge variant="outline">{account.email}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Password: {account.password}</p>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
