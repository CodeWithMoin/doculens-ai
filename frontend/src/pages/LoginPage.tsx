import { type FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, FileCheck2, LockKeyhole, Sparkles } from 'lucide-react';

import { useAuth } from '../auth/useAuth';
import { Logo } from '../components/brand/Logo';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ThemeToggle } from '../components/ui/theme-toggle';
import { useSettings } from '../settings/useSettings';

const DEMO_ACCOUNT = { email: 'analyst@doculens.ai', password: 'Analyst!234' };

export function LoginPage() {
  const { user, login } = useAuth();
  const { serverConfig } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = (location.state as { from?: { pathname?: string } } | undefined)?.from;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user || serverConfig?.showcase_read_only) return <Navigate to="/app" replace />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate(fromState?.pathname ?? '/app', { replace: true });
    } catch {
      setError('Those credentials do not match this workspace.');
      setIsSubmitting(false);
    }
  };

  const useDemo = () => {
    setEmail(DEMO_ACCOUNT.email);
    setPassword(DEMO_ACCOUNT.password);
    setError(null);
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr,0.95fr]">
      <div className="relative hidden overflow-hidden border-r border-border bg-foreground p-12 text-background lg:flex lg:flex-col">
        <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_25%_20%,hsl(var(--docu-primary)/.55),transparent_34%),radial-gradient(circle_at_90%_90%,hsl(var(--docu-primary)/.3),transparent_30%)]" />
        <div className="relative"><Logo className="[&_span]:text-background [&_span_span]:text-background/50" /></div>
        <div className="relative my-auto max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-background/15 bg-background/[0.06] px-3 py-1.5 text-xs text-background/70"><Sparkles className="h-3.5 w-3.5" /> Evidence-first document AI</span>
          <h1 className="mt-7 text-balance text-5xl font-semibold leading-[1.03] tracking-[-0.055em] xl:text-6xl">Turn documents into decisions.</h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-background/60">Search, summarize, classify, and ask complex questions—with every insight grounded in the source.</p>
          <div className="mt-10 grid gap-3 text-sm text-background/70 sm:grid-cols-2">
            {['Precise semantic retrieval', 'Page-level citations', 'Structured AI outputs', 'Auditable event history'].map((item) => <div key={item} className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-background/10"><Check className="h-3 w-3" /></span>{item}</div>)}
          </div>
        </div>
        <div className="relative flex items-center gap-3 border-t border-background/10 pt-6 text-xs text-background/50"><FileCheck2 className="h-4 w-4" /> Built for teams where evidence matters.</div>
      </div>

      <div className="flex min-h-screen flex-col px-5 py-5 sm:px-10 lg:px-16 xl:px-24">
        <div className="flex items-center justify-between lg:justify-end"><Logo className="lg:hidden" /><div className="flex items-center gap-2"><ThemeToggle /><Button variant="ghost" size="sm" asChild className="rounded-full"><Link to="/"><ArrowLeft className="mr-2 h-3.5 w-3.5" /> Back home</Link></Button></div></div>
        <div className="my-auto w-full max-w-md self-center py-12">
          <div className="mb-9"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Workspace access</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">Welcome back</h2><p className="mt-2 text-sm text-muted-foreground">Sign in to continue to your DocuLens workspace.</p></div>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2"><label className="text-xs font-semibold" htmlFor="email">Work email</label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" className="h-11 rounded-xl bg-background" /></div>
            <div className="space-y-2"><div className="flex justify-between"><label className="text-xs font-semibold" htmlFor="password">Password</label><button type="button" className="text-xs font-medium text-primary">Forgot password?</button></div><div className="relative"><Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="h-11 rounded-xl bg-background pr-10" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
            {error ? <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">{error}</div> : null}
            <Button type="submit" className="h-11 w-full rounded-xl" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Continue'} {!isSubmitting ? <ArrowRight className="ml-2 h-4 w-4" /> : null}</Button>
          </form>
          <div className="my-7 flex items-center gap-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60"><span className="h-px flex-1 bg-border" /> Portfolio demo <span className="h-px flex-1 bg-border" /></div>
          <button type="button" onClick={useDemo} className="flex w-full items-center justify-between rounded-xl border border-border bg-surface-subtle px-4 py-3 text-left transition hover:border-muted-foreground/30 hover:bg-muted"><span><span className="block text-xs font-semibold">Use analyst demo</span><span className="mt-0.5 block text-[10px] text-muted-foreground">Pre-fill local demo credentials</span></span><LockKeyhole className="h-4 w-4 text-muted-foreground" /></button>
          <p className="mt-7 text-center text-[11px] leading-5 text-muted-foreground">By continuing, you agree to the workspace security policy.<br />Demo accounts are disabled in production.</p>
        </div>
      </div>
    </div>
  );
}
