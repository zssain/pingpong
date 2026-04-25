/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0E0F11',
        surface: '#16181B',
        'surface-2': '#1C1F23',
        border: '#2A2D31',
        'border-mid': '#3A3E44',
        text: '#E8E6E1',
        'text-muted': '#86898E',
        'text-dim': '#4A4D52',
        accent: '#D4A574',
        'accent-dim': '#8A6E48',
        'accent-glow': 'rgba(212, 165, 116, 0.08)',
        alert: '#D45550',
        success: '#7FA88B',
      },
      fontFamily: {
        mono: ['"DM Mono"', 'ui-monospace', 'monospace'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 150ms ease-out',
        'card-in': 'cardIn 200ms ease-out both',
        'pulse-slow': 'pulse 2s ease-in-out infinite',
        'breathe': 'breathe 10s ease-in-out infinite',
        'slide-up': 'slideUp 200ms ease-out both',
        'draw-check': 'drawCheck 400ms ease-out both',
        'ring-expand': 'ringExpand 600ms ease-out both',
        'spin-slow': 'spin 8s linear infinite',
        'subtle-breath': 'subtle-breath 8s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        cardIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        breathe: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        drawCheck: {
          from: { strokeDashoffset: '24' },
          to: { strokeDashoffset: '0' },
        },
        'subtle-breath': {
          '0%, 100%': { borderColor: '#2A2D31' },
          '50%': { borderColor: '#3A3E44' },
        },
        ringExpand: {
          from: { opacity: '1', transform: 'scale(0.5)' },
          to: { opacity: '0', transform: 'scale(2.5)' },
        },
      },
    },
  },
  plugins: [],
}
