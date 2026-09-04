/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Accent is driven by CSS variables so the user can switch palettes
        // live from Settings without rebuilding.
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
          ink: 'rgb(var(--accent-ink) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          card: 'rgb(var(--surface-card) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)',
        },
        content: {
          DEFAULT: 'rgb(var(--content) / <alpha-value>)',
          soft: 'rgb(var(--content-soft) / <alpha-value>)',
          faint: 'rgb(var(--content-faint) / <alpha-value>)',
        },
        line: 'rgb(var(--line) / <alpha-value>)',
      },
      borderRadius: {
        xl: '1.1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        soft: '0 4px 20px -6px rgb(0 0 0 / 0.12), 0 2px 6px -2px rgb(0 0 0 / 0.08)',
        card: '0 8px 30px -10px rgb(0 0 0 / 0.15)',
        glow: '0 0 0 4px rgb(var(--accent) / 0.15)',
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Baloo 2', 'Nunito', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'check-pop': {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '60%': { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'fade-up': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      animation: {
        'check-pop': 'check-pop 0.28s ease-out',
        'fade-up': 'fade-up 0.3s ease-out',
        'slide-in': 'slide-in 0.25s ease-out',
      },
    },
  },
  plugins: [],
};
