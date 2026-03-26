/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          primary:   '#0A0F1C',
          secondary: '#111827',
          card:      'rgba(17,24,39,0.85)',
        },
        accent: {
          primary: '#06D6A0',
          warning: '#FFD166',
          danger:  '#EF476F',
          info:    '#118AB2',
          glow:    '#06D6A0',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['Outfit', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'spin-slow':  'spin 3s linear infinite',
        'count-up':   'countUp 0.5s ease-out',
        'slide-in':   'slideIn 0.4s ease-out',
        'fade-in':    'fadeIn 0.3s ease-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 5px #06D6A0, 0 0 20px #06D6A040' },
          '50%':      { boxShadow: '0 0 10px #06D6A0, 0 0 40px #06D6A060' },
        },
        slideIn: {
          from: { opacity: 0, transform: 'translateX(20px)' },
          to:   { opacity: 1, transform: 'translateX(0)' },
        },
        fadeIn: {
          from: { opacity: 0 },
          to:   { opacity: 1 },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
