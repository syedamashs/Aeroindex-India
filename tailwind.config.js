/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4f9',
          100: '#dce5f0',
          200: '#b9c9e0',
          300: '#8ba5cc',
          400: '#5779b3',
          500: '#345a98',
          600: '#244680',
          700: '#1b3766',
          800: '#15294d',
          900: '#0f1d38',
          950: '#0a1428',
        },
        accent: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        success: {
          500: '#16a34a',
          600: '#15803d',
        },
        warning: {
          500: '#f59e0b',
          600: '#d97706',
        },
        danger: {
          500: '#dc2626',
          600: '#b91c1c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(15, 29, 56, 0.08), 0 1px 2px 0 rgba(15, 29, 56, 0.04)',
        'card-hover': '0 4px 12px 0 rgba(15, 29, 56, 0.12), 0 2px 4px 0 rgba(15, 29, 56, 0.06)',
      },
    },
  },
  plugins: [],
};
