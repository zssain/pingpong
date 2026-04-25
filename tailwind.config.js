/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        'fade-in': 'fadeIn 150ms ease-out',
        'card-in': 'cardIn 200ms ease-out both',
        'pulse-slow': 'pulse 2s ease-in-out infinite',
        'breathe': 'breathe 10s ease-in-out infinite',
        'slide-up': 'slideUp 200ms ease-out both',
        'draw-check': 'drawCheck 400ms ease-out both',
        'ring-expand': 'ringExpand 600ms ease-out both',
        'spin-slow': 'spin 8s linear infinite',
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
        ringExpand: {
          from: { opacity: '1', transform: 'scale(0.5)' },
          to: { opacity: '0', transform: 'scale(2.5)' },
        },
      },
    },
  },
  plugins: [],
}
