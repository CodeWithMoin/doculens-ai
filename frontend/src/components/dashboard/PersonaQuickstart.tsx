import { ArrowRight } from 'lucide-react';

import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useSettings } from '../../settings/useSettings';
import type { Persona as SettingsPersona } from '../../settings/types';
import { PERSONA_CONFIG } from './personaConfig';

export function PersonaQuickstart() {
  const { settings, setPersona } = useSettings();
  const persona = settings.persona;
  const config = PERSONA_CONFIG[persona];

  return (
    <Card className="shadow-none">
      <CardHeader>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <config.icon className="h-6 w-6 text-primary" />
            <div>
              <CardTitle className="text-base font-semibold text-foreground">Quickstart for your role</CardTitle>
              <p className="text-xs text-muted-foreground">Choose a focus persona to see suggested actions.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PERSONA_CONFIG) as SettingsPersona[]).map((key) => (
              <Button
                key={key}
                variant={key === persona ? 'accent' : 'ghost'}
                size="sm"
                onClick={() => setPersona(key)}
              >
                {PERSONA_CONFIG[key].label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {config.actions.map((action) => (
          <QuickstartActionCard key={action.title} title={action.title} description={action.description} href={action.href} />
        ))}
      </CardContent>
    </Card>
  );
}

interface QuickstartActionCardProps {
  title: string;
  description: string;
  href: string;
}

function QuickstartActionCard({ title, description, href }: QuickstartActionCardProps) {
  return (
    <div className="flex h-full flex-col justify-between rounded-lg border border-border/70 bg-white p-4">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Button asChild variant="ghost" className="mt-3 h-auto justify-start p-0 text-sm text-primary">
        <a href={href} className="inline-flex items-center gap-1">
          Open
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </Button>
    </div>
  );
}
