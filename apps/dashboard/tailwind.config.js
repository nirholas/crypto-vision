/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ═══════════════════════════════════════════════════════════════
        // CRYPTO VISION - TRADING TERMINAL DESIGN TOKENS
        // Bloomberg-style dark theme with teal/purple accent
        // ═══════════════════════════════════════════════════════════════

        // Background hierarchy
        background: {
          DEFAULT: 'var(--bg-primary)',
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
        },

        // Surface hierarchy (cards, modals, dropdowns)
        surface: {
          DEFAULT: 'var(--surface)',
          alt: 'var(--surface-alt)',
          hover: 'var(--surface-hover)',
          elevated: 'var(--surface-elevated)',
          border: 'var(--surface-border)',
        },

        // Text hierarchy
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          disabled: 'var(--text-disabled)',
        },

        // Brand colors (teal accent)
        brand: {
          DEFAULT: 'var(--brand)',
          50: 'rgba(0, 212, 170, 0.05)',
          100: 'rgba(0, 212, 170, 0.1)',
          200: 'rgba(0, 212, 170, 0.2)',
          300: '#33dfbe',
          400: '#1ad9b4',
          500: 'var(--brand)',
          600: 'var(--brand-hover)',
          700: '#00b890',
          800: '#009976',
          900: '#007a5e',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          hover: 'var(--secondary-hover)',
        },

        // Semantic colors
        gain: {
          DEFAULT: 'var(--gain)',
          bg: 'var(--gain-bg)',
        },
        loss: {
          DEFAULT: 'var(--loss)',
          bg: 'var(--loss-bg)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          bg: 'var(--warning-bg)',
        },
        info: {
          DEFAULT: 'var(--info)',
        },

        // Chart colors (for data viz)
        chart: {
          blue: '#3b82f6',
          green: 'var(--gain)',
          red: 'var(--loss)',
          orange: 'var(--warning)',
          purple: 'var(--secondary)',
          teal: 'var(--primary)',
          pink: '#EC4899',
          cyan: '#06B6D4',
        },
      },

      // Border colors
      borderColor: {
        DEFAULT: 'var(--surface-border)',
        surface: {
          DEFAULT: 'var(--surface-border)',
          hover: 'var(--surface-hover)',
        },
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'monospace'],
      },

      fontSize: {
        display: ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        headline: ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        title: ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        body: ['1rem', { lineHeight: '1.6' }],
        caption: ['0.875rem', { lineHeight: '1.5' }],
        tiny: ['0.75rem', { lineHeight: '1.4' }],
        micro: ['0.6875rem', { lineHeight: '1.3' }],
      },

      spacing: {
        18: '4.5rem',
        88: '22rem',
        100: '25rem',
        120: '30rem',
        sidebar: 'var(--sidebar-width)',
        'sidebar-collapsed': 'var(--sidebar-collapsed-width)',
        topbar: 'var(--topbar-height)',
      },

      borderRadius: {
        none: '0',
        sm: '0.125rem',
        DEFAULT: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
        full: '9999px',
      },

      boxShadow: {
        soft: '0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3)',
        card: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.4)',
        glow: '0 0 15px rgba(0, 212, 170, 0.15)',
        'glow-lg': '0 0 30px rgba(0, 212, 170, 0.2)',
        'glow-green': '0 0 15px rgba(0, 255, 0, 0.15)',
        'glow-red': '0 0 15px rgba(255, 0, 0, 0.15)',
        'glow-purple': '0 0 15px rgba(123, 97, 255, 0.15)',
        elevated: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
        'inner-glow': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.03)',
      },

      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-in-up': 'fadeInUp 0.4s ease-out',
        'slide-in': 'slideInRight 0.3s ease-out',
        'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 2s infinite',
        'spin-slow': 'spin 3s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'slide-up-fade': 'slideUpFade 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-down-fade': 'slideDownFade 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        'shake': 'shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97)',
        'count-up': 'countUp 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        'border-glow': 'borderGlow 3s ease-in-out infinite',
        'status-pulse': 'statusPulse 2s ease-in-out infinite',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        slideUpFade: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDownFade: {
          '0%': { opacity: '0', transform: 'translateY(-16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
        countUp: {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        borderGlow: {
          '0%, 100%': {
            'border-color': 'rgba(0, 212, 170, 0.3)',
            'box-shadow': '0 0 10px rgba(0, 212, 170, 0.1)',
          },
          '50%': {
            'border-color': 'rgba(0, 212, 170, 0.6)',
            'box-shadow': '0 0 20px rgba(0, 212, 170, 0.3)',
          },
        },
        statusPulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.8)', opacity: '0' },
        },
      },

      transitionDuration: {
        400: '400ms',
      },

      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
