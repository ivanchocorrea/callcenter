import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef6ff',
          100: '#d9eaff',
          200: '#bcdaff',
          300: '#8dc1ff',
          400: '#569dff',
          500: '#2d7eff',
          600: '#1a63eb',
          700: '#164dc4',
          800: '#19429b',
          900: '#1b3b7a',
          950: '#15264d',
        },
      },
      fontFamily: {
        // Stack de fuentes nativas del SO — sin depender de Google Fonts.
        // Antes usaba 'Inter' descargado en build via next/font/google,
        // pero el build fallaba cuando el VPS tenia timeout a
        // fonts.googleapis.com. Esto es mas confiable y no requiere red.
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
