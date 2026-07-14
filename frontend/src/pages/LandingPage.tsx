import { type ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleCheck,
  Database,
  FileCheck2,
  FileSearch,
  Github,
  Layers3,
  MessageSquareText,
  Network,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UsersRound,
  WalletCards,
  Workflow,
  Zap,
} from 'lucide-react';

import { Logo } from '../components/brand/Logo';
import { Button } from '../components/ui/button';
import { ThemeToggle } from '../components/ui/theme-toggle';

const capabilities = [
  { icon: ScanLine, title: 'Structure-aware extraction', copy: 'Keep headings, tables, page numbers, and reading order intact through ingestion.' },
  { icon: Search, title: 'Retrieval with intent', copy: 'Find the passages that answer a question, not merely the pages sharing its keywords.' },
  { icon: MessageSquareText, title: 'Grounded document chat', copy: 'Reason across long files while keeping every claim tied to its supporting context.' },
  { icon: FileCheck2, title: 'Evidence by default', copy: 'Expose source document, page, chunk, and confidence alongside every generated answer.' },
  { icon: Layers3, title: 'Multi-document synthesis', copy: 'Compare contracts, policies, reports, and research without losing provenance.' },
  { icon: ShieldCheck, title: 'Operational control', copy: 'Track ingestion, classifications, reviews, retries, and lifecycle events in one workspace.' },
];

const useCases = [
  { icon: FileCheck2, team: 'Legal', question: 'Where do renewal terms conflict across our vendor agreements?', outcome: 'Clause review with page-level evidence' },
  { icon: ShieldCheck, team: 'Compliance', question: 'Which controls are incomplete, and what source proves it?', outcome: 'Auditable gap analysis' },
  { icon: BrainCircuit, team: 'Research', question: 'What do these studies agree on—and where do they diverge?', outcome: 'Cross-document synthesis' },
  { icon: WalletCards, team: 'Finance', question: 'What changed between the forecast and the board report?', outcome: 'Traceable variance analysis' },
  { icon: UsersRound, team: 'People', question: 'Which policy applies to this employee request?', outcome: 'Fast policy navigation' },
];

const stack = ['React 19', 'TypeScript', 'FastAPI', 'Celery', 'Docling', 'PostgreSQL', 'pgvector', 'OpenAI'];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 12);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground selection:bg-primary/15">
      <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? 'border-b border-border/70 bg-background/88 backdrop-blur-xl' : 'bg-transparent'}`}>
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-5 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-7 text-[13px] font-medium text-muted-foreground md:flex" aria-label="Primary navigation">
            <a href="#product" className="hover:text-foreground">Product</a>
            <a href="#workflow" className="hover:text-foreground">How it works</a>
            <a href="#architecture" className="hover:text-foreground">Architecture</a>
            <a href="#use-cases" className="hover:text-foreground">Use cases</a>
          </nav>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild className="hidden rounded-full sm:inline-flex"><Link to="/login">Sign in</Link></Button>
            <Button size="sm" asChild className="rounded-full px-4"><Link to="/app">Open workspace <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link></Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative border-b border-border/70 px-5 pb-20 pt-28 lg:px-8 lg:pb-28 lg:pt-36">
          <div className="hero-glow" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-[1320px] gap-14 lg:grid-cols-[0.82fr,1.18fr] lg:items-center xl:gap-20">
            <div className="max-w-xl">
              <div className="animate-rise inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Open-source document intelligence <ChevronRight className="h-3 w-3" />
              </div>
              <h1 className="animate-rise-delay mt-7 text-balance text-[clamp(3.4rem,6.4vw,6.2rem)] font-semibold leading-[0.93] tracking-[-0.067em]">
                Ask your documents.
                <span className="block text-muted-foreground/58">Inspect the evidence.</span>
              </h1>
              <p className="animate-rise-delay-2 mt-7 max-w-lg text-balance text-lg leading-8 text-muted-foreground">
                DocuLens turns complex files into cited, searchable knowledge—so your team can move faster without guessing what the model saw.
              </p>
              <div className="animate-rise-delay-2 mt-9 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" asChild className="h-12 rounded-full px-6 text-sm shadow-[0_14px_38px_-18px_hsl(var(--docu-primary))]"><Link to="/app">Explore the workspace <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                <Button variant="outline" size="lg" asChild className="h-12 rounded-full bg-background/70 px-6 text-sm"><a href="https://github.com/codewithmoin/doculens-ai" target="_blank" rel="noreferrer"><Github className="mr-2 h-4 w-4" />View source</a></Button>
              </div>
              <div className="animate-rise-delay-3 mt-9 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-medium text-muted-foreground">
                {['Page-level citations', 'Layout-aware ingestion', 'Provider flexible'].map((item) => <span key={item} className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" />{item}</span>)}
              </div>
            </div>

            <EvidenceCanvas />
          </div>

          <div className="relative mx-auto mt-16 grid max-w-[1320px] border-y border-border/70 sm:grid-cols-3">
            <ProofPoint value="Citation-first" label="Every answer retains its path to source" />
            <ProofPoint value="Async by design" label="Long-running AI work stays off request threads" />
            <ProofPoint value="Measured retrieval" label="Recall@K and MRR utilities included" />
          </div>
        </section>

        <section id="product" className="px-5 py-24 lg:px-8 lg:py-32">
          <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[0.72fr,1.28fr] lg:gap-24">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <Eyebrow>One evidence layer</Eyebrow>
              <h2 className="mt-5 text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.05em] md:text-5xl">Built for the moment an answer matters.</h2>
              <p className="mt-6 text-base leading-7 text-muted-foreground">Extraction, retrieval, generation, and review belong in one coherent workflow. DocuLens keeps them connected through source provenance.</p>
              <Button asChild variant="outline" className="mt-8 rounded-full"><a href="#architecture">See the architecture <ArrowRight className="ml-2 h-4 w-4" /></a></Button>
            </div>
            <div className="divide-y divide-border border-y border-border">
              {capabilities.map(({ icon: Icon, title, copy }, index) => (
                <article key={title} className="group grid gap-4 py-7 sm:grid-cols-[44px,1fr] sm:py-8">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-surface-subtle text-muted-foreground transition group-hover:border-primary/30 group-hover:text-primary"><Icon className="h-[18px] w-[18px]" /></span>
                  <div className="grid gap-2 sm:grid-cols-[0.68fr,1fr] sm:gap-8"><h3 className="text-base font-semibold tracking-tight"><span className="mr-3 font-mono text-[10px] font-normal text-muted-foreground/60">0{index + 1}</span>{title}</h3><p className="text-sm leading-6 text-muted-foreground">{copy}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="border-y border-border/70 bg-foreground px-5 py-24 text-background lg:px-8 lg:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-background/45">From file to finding</p><h2 className="mt-4 max-w-2xl text-balance text-4xl font-semibold tracking-[-0.05em] md:text-5xl">A pipeline you can explain.</h2></div>
              <p className="max-w-md text-sm leading-6 text-background/55">Every stage produces typed, inspectable outputs instead of hiding work inside one model call.</p>
            </div>
            <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-background/12 bg-background/12 md:grid-cols-3">
              <WorkflowStep index="01" icon={<UploadCloud />} title="Ingest" copy="Extract structure, OCR scans, and preserve page provenance." detail="Docling + validation" />
              <WorkflowStep index="02" icon={<Network />} title="Understand" copy="Create bounded chunks, batch embeddings, and retrieve with filters." detail="pgvector + evaluation" />
              <WorkflowStep index="03" icon={<Sparkles />} title="Answer" copy="Construct grounded context and return evidence with confidence." detail="Structured model output" />
            </div>
          </div>
        </section>

        <section className="px-5 py-24 lg:px-8 lg:py-32">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.1fr,0.9fr] lg:items-center">
            <EvidenceStory />
            <div className="lg:pl-10">
              <Eyebrow>Trust is a product feature</Eyebrow>
              <h2 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.05em] md:text-5xl">Answers that show their work.</h2>
              <p className="mt-6 text-base leading-7 text-muted-foreground">A fluent answer is not enough. DocuLens pairs each claim with source context, page metadata, retrieval confidence, and the original document.</p>
              <div className="mt-8 space-y-4">
                <TrustRow title="Source-linked claims" copy="Open the exact page behind a conclusion." />
                <TrustRow title="Visible confidence" copy="Know when an answer deserves review." />
                <TrustRow title="Auditable history" copy="Retain queries, outputs, and lifecycle events." />
              </div>
            </div>
          </div>
        </section>

        <section id="architecture" className="border-y border-border/70 bg-surface-subtle px-5 py-24 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_28px_90px_-55px_rgba(10,18,35,0.45)]">
            <div className="grid lg:grid-cols-[0.8fr,1.2fr]">
              <div className="border-b border-border p-7 md:p-10 lg:border-b-0 lg:border-r">
                <Eyebrow>Production-minded architecture</Eyebrow>
                <h2 className="mt-5 text-3xl font-semibold tracking-[-0.045em]">Fast at the edge. Durable underneath.</h2>
                <p className="mt-5 text-sm leading-7 text-muted-foreground">FastAPI accepts work quickly. Celery handles retryable document and model tasks. PostgreSQL remains the durable boundary for events, metadata, and vectors.</p>
                <div className="mt-8 flex flex-wrap gap-2">{stack.map((item) => <span key={item} className="rounded-full border border-border bg-surface-subtle px-3 py-1.5 font-mono text-[10px] text-muted-foreground">{item}</span>)}</div>
              </div>
              <ArchitectureMap />
            </div>
          </div>
        </section>

        <section id="use-cases" className="px-5 py-24 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl"><Eyebrow>Evidence-heavy work</Eyebrow><h2 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.05em] md:text-5xl">Useful wherever the source matters.</h2></div>
            <div className="mt-14 divide-y divide-border border-y border-border">
              {useCases.map(({ icon: Icon, team, question, outcome }) => (
                <article key={team} className="grid gap-4 py-6 md:grid-cols-[180px,1fr,260px] md:items-center md:gap-8">
                  <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface-subtle"><Icon className="h-4 w-4" /></span><h3 className="text-sm font-semibold">{team}</h3></div>
                  <p className="text-sm font-medium leading-6">“{question}”</p>
                  <p className="text-xs leading-5 text-muted-foreground md:text-right">{outcome}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-24 lg:px-8 lg:pb-32">
          <div className="mx-auto max-w-6xl rounded-[28px] bg-primary px-6 py-14 text-primary-foreground sm:px-10 md:py-18">
            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/60">Make documents operational</p><h2 className="mt-4 max-w-2xl text-balance text-4xl font-semibold tracking-[-0.05em] md:text-6xl">Know what your documents know.</h2><p className="mt-5 max-w-xl text-sm leading-6 text-primary-foreground/70">Run DocuLens locally, inspect the architecture, and ask your first evidence-grounded question.</p></div>
              <Button size="lg" asChild className="h-12 shrink-0 rounded-full bg-background px-6 text-foreground hover:bg-background/90"><Link to="/app">Open DocuLens <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 px-5 py-8 lg:px-8">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <Logo /><p>Open-source document intelligence, built around evidence.</p>
          <div className="flex items-center gap-5"><a href="https://github.com/codewithmoin/doculens-ai" target="_blank" rel="noreferrer">GitHub</a><a href="/docs">Documentation</a><a href="https://github.com/codewithmoin/doculens-ai/blob/main/LICENSE" target="_blank" rel="noreferrer">MIT License</a></div>
        </div>
      </footer>
    </div>
  );
}

function EvidenceCanvas() {
  return (
    <div className="animate-rise-delay-3 relative">
      <div className="absolute -inset-6 rounded-[38px] border border-primary/10" />
      <div className="relative overflow-hidden rounded-[26px] border border-border/80 bg-card shadow-[0_42px_110px_-50px_rgba(10,18,35,0.5)]">
        <div className="flex h-12 items-center justify-between border-b border-border/70 px-4">
          <div className="flex gap-1.5"><span className="h-2 w-2 rounded-full bg-border" /><span className="h-2 w-2 rounded-full bg-border" /><span className="h-2 w-2 rounded-full bg-border" /></div>
          <div className="flex items-center gap-2 text-[9px] font-medium text-muted-foreground"><ShieldCheck className="h-3 w-3 text-emerald-600" />Private workspace</div>
        </div>
        <div className="grid min-h-[560px] sm:grid-cols-[minmax(0,1fr),205px]">
          <div className="document-grid relative p-4 sm:p-6">
            <div className="mx-auto max-w-md rounded-lg border border-border/80 bg-background p-5 shadow-sm sm:p-7">
              <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-4"><div><p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Master services agreement</p><p className="mt-1 text-xs font-semibold">Acme Cloud, Inc.</p></div><span className="font-mono text-[9px] text-muted-foreground">18 / 28</span></div>
              <p className="mt-5 text-[9px] font-semibold uppercase tracking-[0.14em]">12. Term and termination</p>
              <div className="mt-3 space-y-2 text-[10px] leading-5 text-muted-foreground"><p>This Agreement begins on the Effective Date and continues for the Initial Term.</p><p className="rounded-md border-l-2 border-amber-400 bg-amber-100/70 px-3 py-2 text-foreground dark:bg-amber-950/25">Thereafter, the Agreement automatically renews for successive one-year periods unless either party provides written notice at least sixty (60) days before renewal.</p><p>Either party may terminate for material breach following a thirty-day cure period.</p></div>
            </div>
            <div className="relative mx-auto -mt-3 max-w-lg rounded-2xl border border-primary/25 bg-card p-4 shadow-[0_18px_55px_-28px_rgba(10,18,35,0.5)] sm:p-5">
              <div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></span><div><div className="flex items-center justify-between gap-4"><p className="text-xs font-semibold">Answer</p><span className="text-[9px] font-medium text-emerald-600">94% confidence</span></div><p className="mt-2 text-xs leading-5 text-muted-foreground">The agreement renews annually unless either party gives <strong className="font-semibold text-foreground">60 days’ written notice</strong>. Material breach has a 30-day cure period.</p><div className="mt-3 flex gap-2"><SourcePill label="MSA · p.18" /><SourcePill label="Section 12" /></div></div></div>
            </div>
          </div>
          <aside className="hidden border-l border-border/70 bg-surface-subtle/65 p-4 sm:block">
            <div className="flex items-center justify-between"><p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Evidence</p><span className="rounded-full bg-amber-100 px-2 py-0.5 text-[8px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">2 sources</span></div>
            <SourceCard index="01" title="Master Services Agreement.pdf" page="Page 18" score="96%" active />
            <SourceCard index="02" title="Renewal Schedule.pdf" page="Page 4" score="89%" />
            <div className="mt-5 rounded-xl border border-dashed border-border p-3"><p className="text-[9px] font-semibold">Why this answer?</p><p className="mt-2 text-[9px] leading-4 text-muted-foreground">Both passages directly define renewal notice and termination timing.</p></div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ProofPoint({ value, label }: { value: string; label: string }) {
  return <div className="border-border/70 px-5 py-5 sm:border-r sm:px-8 sm:last:border-r-0"><p className="text-sm font-semibold tracking-tight">{value}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{label}</p></div>;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{children}</p>;
}

function WorkflowStep({ index, icon, title, copy, detail }: { index: string; icon: ReactNode; title: string; copy: string; detail: string }) {
  return <article className="bg-foreground p-7 md:p-8"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl border border-background/15 text-background/75 [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span><span className="font-mono text-[10px] text-background/30">{index}</span></div><h3 className="mt-12 text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-background/55">{copy}</p><p className="mt-7 border-t border-background/10 pt-4 font-mono text-[9px] uppercase tracking-[0.12em] text-background/35">{detail}</p></article>;
}

function EvidenceStory() {
  return (
    <div className="rounded-[24px] border border-border bg-card p-4 shadow-[0_24px_70px_-45px_rgba(10,18,35,0.45)] sm:p-6">
      <div className="rounded-2xl border border-border bg-surface-subtle p-5">
        <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-foreground text-background"><FileSearch className="h-4 w-4" /></span><div><p className="text-xs font-semibold">Q2 Board Report.pdf</p><p className="text-[10px] text-muted-foreground">41 pages · indexed 2 minutes ago</p></div></div>
        <div className="mt-5 rounded-xl bg-background p-4 ring-1 ring-border/70"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Question</p><p className="mt-2 text-sm font-medium">What are the top risks to the forecast?</p></div>
      </div>
      <div className="px-2 pb-1 pt-5 sm:px-4"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><p className="text-xs font-semibold">Grounded answer</p><span className="ml-auto text-[10px] font-medium text-emerald-600">High confidence</span></div><p className="mt-4 text-sm leading-7 text-muted-foreground">The report identifies enterprise concentration, delayed European expansion, and model inference costs as the three material forecast risks.</p><div className="mt-5 grid gap-2 sm:grid-cols-3"><EvidenceMetric value="3" label="claims" /><EvidenceMetric value="4" label="sources" /><EvidenceMetric value="2" label="documents" /></div></div>
    </div>
  );
}

function TrustRow({ title, copy }: { title: string; copy: string }) {
  return <div className="flex gap-3"><CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{copy}</p></div></div>;
}

function ArchitectureMap() {
  const nodes = [
    { icon: Workflow, title: 'FastAPI', copy: 'Validated, versioned API' },
    { icon: Zap, title: 'Celery', copy: 'Durable async workflows' },
    { icon: Network, title: 'RAG pipeline', copy: 'Extract, chunk, retrieve' },
    { icon: Database, title: 'Postgres + vectors', copy: 'Events and evidence' },
  ];
  return <div className="document-grid p-6 md:p-10"><div className="grid gap-3 sm:grid-cols-2">{nodes.map(({ icon: Icon, title, copy }, index) => <div key={title} className="relative rounded-2xl border border-border bg-background p-5 shadow-sm"><div className="flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-subtle"><Icon className="h-4 w-4" /></span><span className="font-mono text-[9px] text-muted-foreground/60">0{index + 1}</span></div><p className="mt-6 text-sm font-semibold">{title}</p><p className="mt-1 text-[11px] text-muted-foreground">{copy}</p></div>)}</div></div>;
}

function SourcePill({ label }: { label: string }) {
  return <span className="rounded-md border border-amber-300/70 bg-amber-50 px-2 py-1 text-[9px] font-medium text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/25 dark:text-amber-300">{label}</span>;
}

function SourceCard({ index, title, page, score, active = false }: { index: string; title: string; page: string; score: string; active?: boolean }) {
  return <div className={`mt-3 rounded-xl border p-3 ${active ? 'border-primary/30 bg-background shadow-sm' : 'border-border bg-background/60'}`}><div className="flex items-start gap-2"><span className="font-mono text-[8px] text-muted-foreground">{index}</span><div className="min-w-0"><p className="truncate text-[9px] font-semibold">{title}</p><div className="mt-2 flex items-center justify-between text-[8px] text-muted-foreground"><span>{page}</span><span>{score}</span></div></div></div></div>;
}

function EvidenceMetric({ value, label }: { value: string; label: string }) {
  return <div className="rounded-xl border border-border bg-surface-subtle px-3 py-3 text-center"><p className="text-lg font-semibold">{value}</p><p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p></div>;
}
