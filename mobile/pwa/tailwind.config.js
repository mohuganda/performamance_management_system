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
        primary: {
          DEFAULT: '#1A1A1A',
          50: '#F6F6F7',
          100: '#EAEAEB',
          200: '#D5D5D8',
          300: '#B4B4B9',
          400: '#8E8E93',
          500: '#1A1A1A',
          600: '#161616',
          700: '#121212',
          800: '#0E0E0E',
          900: '#0A0A0A',
          950: '#050505',
        },
        background: {
          DEFAULT: '#F4F4F5',
          dark: '#010101',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          dark: '#1E1E1E',
        },
        border: {
          DEFAULT: '#E4E4E7',
          dark: '#27272A',
        },
        national: {
          black: '#1A1A1A',
          yellow: '#FCDC04',
          red: '#D90000',
        },
        moh: {
          green: '#15803D',
          amber: '#B45309',
          red: '#D90000',
          blue: '#2563EB',
        }
      },
    },
  },
  plugins: [],
};
