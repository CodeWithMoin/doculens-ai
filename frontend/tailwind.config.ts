import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--docu-background))',
        foreground: 'hsl(var(--docu-foreground))',
        lapis: {
          DEFAULT: '#2f6690',
          100: '#09141c',
          200: '#122839',
          300: '#1c3c55',
          400: '#255172',
          500: '#2f6690',
          600: '#3e87bf',
          700: '#6da5d0',
          800: '#9ec3e0',
          900: '#cee1ef',
        },
        cerulean: {
          DEFAULT: '#3a7ca5',
          100: '#0c1921',
          200: '#173242',
          300: '#234b64',
          400: '#2f6485',
          500: '#3a7ca5',
          600: '#569ac4',
          700: '#80b3d2',
          800: '#aacce1',
          900: '#d5e6f0',
        },
        indigo: {
          DEFAULT: '#16425b',
          100: '#040d12',
          200: '#091a24',
          300: '#0d2736',
          400: '#123448',
          500: '#16425b',
          600: '#256f9a',
          700: '#3f9bd0',
          800: '#7fbce0',
          900: '#bfdeef',
        },
        platinum: {
          DEFAULT: '#d9dcd6',
          100: '#2b2f28',
          200: '#575e50',
          300: '#828c78',
          400: '#adb4a7',
          500: '#d9dcd6',
          600: '#e0e3de',
          700: '#e8eae6',
          800: '#f0f1ee',
          900: '#f7f8f7',
        },
        'sky-blue': {
          DEFAULT: '#81c3d7',
          100: '#102c34',
          200: '#215768',
          300: '#31839c',
          400: '#4ba9c6',
          500: '#81c3d7',
          600: '#99cedf',
          700: '#b2dbe7',
          800: '#cce7ef',
          900: '#e5f3f7',
        },
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
  plugins: [forms],
};

export default config;
