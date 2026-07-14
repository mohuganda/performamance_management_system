/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
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
      },
      borderRadius: {
        none: '0px',
        xs: '0px',
        sm: '0px',
        DEFAULT: '0px',
        md: '0px',
        lg: '0px',
        xl: '0px',
        '2xl': '0px',
        '3xl': '0px',
        full: '0px',
      },
    },
  },
  plugins: [],
};
