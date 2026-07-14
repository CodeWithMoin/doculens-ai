import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

import { Button } from './button';

function readTheme() {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage.getItem('doculens.theme');
  return stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeToggle() {
  const [dark, setDark] = useState(readTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    window.localStorage.setItem('doculens.theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setDark((current) => !current)} aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}>
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
