const withMT = require('@material-tailwind/react/utils/withMT')

/** @type {import('tailwindcss').Config} */
module.exports = withMT({
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    // Override Material Tailwind's non-standard screens (540/720/960)
    // so responsive nav matches common mobile / tablet / desktop breakpoints.
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        ui: {
          bg: 'var(--color-ui-bg)',
          surface: 'var(--color-ui-surface)',
          text: 'var(--color-ui-text)',
          muted: 'var(--color-ui-muted)',
          border: 'var(--color-ui-border)',
          subtle: 'var(--color-ui-subtle)',
        },
        uganda: {
          black: 'var(--color-uganda-black)',
          yellow: 'var(--color-uganda-yellow)',
          red: 'var(--color-uganda-red)',
        },
        moh: {
          green: 'var(--color-moh-green)',
          gold: 'var(--color-moh-gold)',
          success: 'var(--color-moh-success)',
          warning: 'var(--color-moh-warning)',
          error: 'var(--color-moh-error)',
          background: 'var(--color-moh-background)',
          card: 'var(--color-moh-card)',
        },
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        sm: '0.125rem',
        md: '0.25rem',
        lg: '0.375rem',
      },
      fontFamily: {
        sans: ['Segoe UI', 'Arial', 'Helvetica', 'sans-serif'],
      },
    },
  },
  plugins: [],
})
