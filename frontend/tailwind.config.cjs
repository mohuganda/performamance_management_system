const withMT = require('@material-tailwind/react/utils/withMT')

/** @type {import('tailwindcss').Config} */
module.exports = withMT({
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ui: {
          bg: '#F4F4F5',
          surface: '#FFFFFF',
          text: '#18181B',
          muted: '#71717A',
          border: '#E4E4E7',
          subtle: '#FAFAFA',
        },
        uganda: {
          black: '#1A1A1A',
          yellow: '#FCDC04',
          red: '#D90000',
        },
        moh: {
          green: '#18181B',
          gold: '#FCDC04',
          success: '#15803D',
          warning: '#B45309',
          error: '#D90000',
          background: '#F4F4F5',
          card: '#FFFFFF',
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
