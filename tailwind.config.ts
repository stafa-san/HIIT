import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Trebuchet MS"', '"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        navy: {
          DEFAULT: 'hsl(var(--navy))',
          foreground: 'hsl(var(--navy-foreground))',
          soft: 'hsl(var(--navy-soft))',
          muted: 'hsl(var(--navy-muted))',
        },
        primary: { DEFAULT: 'hsl(var(--navy))', foreground: 'hsl(var(--navy-foreground))' },
        alert: {
          DEFAULT: 'hsl(var(--alert))',
          foreground: 'hsl(var(--alert-foreground))',
          soft: 'hsl(var(--alert-soft))',
        },
        watch: {
          DEFAULT: 'hsl(var(--watch))',
          foreground: 'hsl(var(--watch-foreground))',
          soft: 'hsl(var(--watch-soft))',
        },
        ok: {
          DEFAULT: 'hsl(var(--ok))',
          foreground: 'hsl(var(--ok-foreground))',
          soft: 'hsl(var(--ok-soft))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          soft: 'hsl(var(--success-soft))',
        },
        info: { DEFAULT: 'hsl(var(--info))', soft: 'hsl(var(--info-soft))' },
        chart: {
          practice: 'hsl(var(--chart-practice))',
          game: 'hsl(var(--chart-game))',
          track: 'hsl(var(--chart-track))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 8px)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.35)', opacity: '0' },
          '100%': { transform: 'scale(1.35)', opacity: '0' },
        },
        'flash-in': {
          '0%': { boxShadow: '0 0 0 0 hsl(var(--alert) / 0.55)' },
          '100%': { boxShadow: '0 0 0 14px hsl(var(--alert) / 0)' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.2, 0.6, 0.4, 1) infinite',
        'flash-in': 'flash-in 1.2s ease-out 3',
      },
    },
  },
  plugins: [animate],
};

export default config;
