import { useState } from 'react';
import { Copy, Eye, EyeOff, Globe, KeyRound, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';

import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { useSettings, type Persona } from '../settings/SettingsProvider';
import { PERSONA_CONFIG } from '../components/dashboard/PersonaQuickstart';
import { useNotificationStore } from '../stores/notificationStore';

const personaOptions: Persona[] = ['operations-manager', 'analyst', 'business-owner', 'integrator'];

export function SettingsPage() {
  const { settings, serverConfig, updateSettings, resetSettings, isLoaded, error, setPersona } = useSettings();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);

  const handleCopyApiKey = async () => {
    try {
      await navigator.clipboard.writeText(settings.apiKey || '');
      addNotification({
        title: 'API key copied',
        description: 'The API key is ready to paste into your integration.',
        variant: 'success',
      });
    } catch (err) {
      console.error(err);
      addNotification({ title: 'Copy failed', description: 'Unable to copy the API key.', variant: 'error' });
    }
  };

  const handleRegenerate = () => {
    addNotification({
      title: 'Regeneration requested',
      description: 'Contact your administrator to generate a new key.',
      variant: 'info',
    });
  };

  const personaConfig = PERSONA_CONFIG[settings.persona];

  const curlSnippet = `curl -H "${serverConfig?.api_key_header ?? 'X-API-Key'}: ${settings.apiKey || '<your-key>'}" \\\n  ${settings.apiBaseUrl}/events`;

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-border/70 bg-card/80 shadow-subtle">
        <CardHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-semibold">Client preferences</CardTitle>
          </div>
          <CardDescription>Adjust how the console communicates with the backend API.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isLoaded ? <p className="text-sm text-muted-foreground">Loading server defaults…</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="space-y-2">
            <Label htmlFor="api-base">API base URL</Label>
            <Input
              id="api-base"
              value={settings.apiBaseUrl}
              onChange={(event) => updateSettings({ apiBaseUrl: event.target.value })}
              placeholder="http://localhost:8080"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key">API key (sent via {serverConfig?.api_key_header ?? 'X-API-Key'})</Label>
            <div className="flex gap-2">
              <Input
                id="api-key"
                type={isApiKeyVisible ? 'text' : 'password'}
                value={settings.apiKey}
                onChange={(event) => updateSettings({ apiKey: event.target.value })}
                placeholder="Paste your API key"
              />
              <Button variant="secondary" size="icon" onClick={() => setIsApiKeyVisible((prev) => !prev)}>
                {isApiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button variant="secondary" size="icon" onClick={handleCopyApiKey} disabled={!settings.apiKey}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <button type="button" className="text-primary underline" onClick={handleRegenerate}>
                Request new key
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <PreferenceNumberField
              label="Chunk preview limit"
              value={settings.chunkPreviewLimit}
              onChange={(value) => updateSettings({ chunkPreviewLimit: value })}
              serverDefault={serverConfig?.chunk_preview_limit}
            />
            <PreferenceNumberField
              label="Summary chunk limit"
              value={settings.summaryChunkLimit}
              onChange={(value) => updateSettings({ summaryChunkLimit: value })}
              serverDefault={serverConfig?.summary_chunk_limit}
            />
            <PreferenceNumberField
              label="QA top_k"
              value={settings.qaTopK}
              onChange={(value) => updateSettings({ qaTopK: value })}
              serverDefault={serverConfig?.qa_top_k}
            />
            <PreferenceNumberField
              label="Search result limit"
              value={settings.searchResultLimit}
              onChange={(value) => updateSettings({ searchResultLimit: value })}
              serverDefault={serverConfig?.search_result_limit}
            />
          </div>

          <div className="flex justify-end">
            <Button variant="secondary" className="gap-2" onClick={resetSettings}>
              <RefreshCw className="h-4 w-4" /> Reset to defaults
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80 shadow-subtle">
        <CardHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-semibold">Persona focus</CardTitle>
          </div>
          <CardDescription>Select the workflow you care about most to tailor quickstart actions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {personaOptions.map((option) => (
              <Button
                key={option}
                variant={option === settings.persona ? 'accent' : 'ghost'}
                onClick={() => setPersona(option)}
                className="capitalize"
              >
                {PERSONA_CONFIG[option].label}
              </Button>
            ))}
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">{personaConfig.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{personaConfig.description}</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {personaConfig.actions.slice(0, 2).map((action) => (
                <div key={action.title} className="rounded-md border border-dashed border-border/60 bg-card/70 px-3 py-2">
                  <p className="text-xs font-semibold text-foreground">{action.title}</p>
                  <p className="text-[11px] text-muted-foreground">{action.description}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80 shadow-subtle">
        <CardHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-semibold">Integration playbook</CardTitle>
          </div>
          <CardDescription>Document how to authenticate and monitor DocuLens from other systems.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-semibold text-foreground">Authenticate requests</p>
            <Textarea readOnly value={curlSnippet} className="text-xs" />
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-foreground">Webhook endpoints</p>
            <p className="text-xs text-muted-foreground">
              Configure POST callbacks for job completion under <Badge variant="outline">Settings &gt; Webhooks</Badge> (coming soon).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80 shadow-subtle">
        <CardHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-semibold">Server snapshot</CardTitle>
          </div>
          <CardDescription>Current values surfaced by the backend configuration endpoint.</CardDescription>
        </CardHeader>
        <CardContent>
          {serverConfig ? (
            <dl className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
              <SnapshotItem label="App name" value={serverConfig.app_name} />
              <SnapshotItem label="Auth required" value={serverConfig.auth_required ? 'Yes' : 'No'} />
              <SnapshotItem label="API key header" value={serverConfig.api_key_header} />
              <SnapshotItem label="Chunk preview limit" value={String(serverConfig.chunk_preview_limit)} />
              <SnapshotItem label="Summary chunk limit" value={String(serverConfig.summary_chunk_limit)} />
              <SnapshotItem label="QA top_k" value={String(serverConfig.qa_top_k)} />
              <SnapshotItem label="Search result limit" value={String(serverConfig.search_result_limit)} />
              <SnapshotItem label="Search preview limit" value={String(serverConfig.search_preview_limit)} />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Server settings not available.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface PreferenceNumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  serverDefault?: number;
}

function PreferenceNumberField({ label, value, onChange, serverDefault }: PreferenceNumberFieldProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        min={1}
        value={value}
        onChange={(event) => {
          const numeric = Number(event.target.value);
          if (Number.isFinite(numeric) && numeric > 0) {
            onChange(Math.round(numeric));
          }
        }}
      />
      {serverDefault !== undefined ? (
        <p className="text-xs text-muted-foreground">Server default {serverDefault}</p>
      ) : null}
    </div>
  );
}

function SnapshotItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}
