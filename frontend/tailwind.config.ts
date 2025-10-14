import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--docu-background))',
        foreground: 'hsl(var(--docu-foreground))',
        muted: {
          DEFAULT: 'hsl(var(--docu-muted))',
          foreground: 'hsl(var(--docu-muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--docu-accent))',
          foreground: 'hsl(var(--docu-accent-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--docu-primary))',
          foreground: 'hsl(var(--docu-primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--docu-secondary))',
          foreground: 'hsl(var(--docu-secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--docu-destructive))',
          foreground: 'hsl(var(--docu-destructive-foreground))',
        },
        ring: 'hsl(var(--docu-ring))',
        border: 'hsl(var(--docu-border))',
        input: 'hsl(var(--docu-input))',
        card: {
          DEFAULT: 'hsl(var(--docu-card))',
          foreground: 'hsl(var(--docu-card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--docu-radius-lg)',
        md: 'calc(var(--docu-radius-lg) - 2px)',
        sm: 'calc(var(--docu-radius-lg) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'IBM Plex Mono', 'monospace'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.25s ease-out',
        'accordion-up': 'accordion-up 0.25s ease-out',
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(15, 23, 42, 0.06)',
        focus: '0 0 0 2px hsla(var(--docu-primary) / 0.15)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};

export default config;
