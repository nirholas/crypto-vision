import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0a0b12',
          secondary: '#12141e',
          card: '#1a1d2e',
          hover: '#222640',
        },
        border: {
          DEFAULT: '#2a2d3a',
          active: '#3b3f52',
        },
        text: {
          primary: '#e4e6f0',
          secondary: '#8b8fa3',
          muted: '#565a6e',
        },
        accent: {
          green: '#00e676',
          'green-dim': 'rgba(0,230,118,0.15)',
          red: '#ff5252',
          'red-dim': 'rgba(255,82,82,0.15)',
          blue: '#448aff',
          purple: '#aa66ff',
          orange: '#ffaa33',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Consolas', 'monospace'],
      },
      keyframes: {
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'pulse-slow': 'pulse-slow 3s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
