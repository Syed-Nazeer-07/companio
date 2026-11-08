/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        aura: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
      },
      fontFamily: {
        sans: ['"Segoe UI Variable Display"', '"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 5.2s ease-in-out infinite',
        'companio-idle': 'companioIdle 5.2s ease-in-out infinite',
        'companio-celebrate': 'companioCelebrate 700ms cubic-bezier(0.2, 0.75, 0.25, 1) 1',
        'spin-slow': 'spin 10s linear infinite',
        'glow': 'glow 2.5s ease-in-out infinite alternate',
        'ear-wiggle': 'earWiggle 3s ease-in-out infinite',
        'tail-wag': 'tailWag 2s ease-in-out infinite',
        'breathe': 'breathe 4s ease-in-out infinite',
        'happy-bounce': 'happyBounce 0.8s ease-in-out infinite alternate',
        'sparkle': 'sparkle 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-3px)' },
        },
        companioIdle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
        companioCelebrate: {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '40%': { transform: 'translateY(-9px) scale(1.035)' },
          '70%': { transform: 'translateY(-2px) scale(0.995)' },
        },
        glow: {
          '0%': { filter: 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.3))' },
          '100%': { filter: 'drop-shadow(0 0 18px rgba(56, 189, 248, 0.7))' },
        },
        earWiggle: {
          '0%, 85%, 100%': { transform: 'rotate(0deg)' },
          '90%': { transform: 'rotate(-10deg)' },
          '95%': { transform: 'rotate(8deg)' },
        },
        tailWag: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '50%': { transform: 'rotate(12deg)' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.025)' },
        },
        happyBounce: {
          '0%': { transform: 'translateY(0) scale(1)' },
          '100%': { transform: 'translateY(-12px) scale(1.05)' },
        },
        sparkle: {
          '0%, 100%': { opacity: 0.2, transform: 'scale(0.8)' },
          '50%': { opacity: 1, transform: 'scale(1.2)' },
        }
      }
    },
  },
  plugins: [],
}
