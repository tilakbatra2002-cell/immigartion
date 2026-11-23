/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#101828', 50: '#F8FAFC', 900: '#101828' },
        brand: {
          25: '#F5F8FF', 50: '#EFF4FF', 100: '#DBE6FE', 200: '#BFD3FE', 300: '#93B4FD',
          400: '#6090FA', 500: '#3B76F6', 600: '#2563EB', 700: '#1D4ED8', 800: '#1E40AF', 900: '#1E3A8A',
        },
        canvas: '#F7F9FC',
        line: '#E5E7EB',
        ink: { DEFAULT: '#111827', soft: '#667085', faint: '#98A2B3' },
      },
      fontFamily: {
        sans: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        ui: ['Inter', 'Manrope', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(16 24 40 / 0.04)',
        pop: '0 8px 24px -6px rgb(16 24 40 / 0.12), 0 2px 6px -2px rgb(16 24 40 / 0.06)',
        modal: '0 20px 48px -12px rgb(16 24 40 / 0.24)',
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '14px' }],
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['13px', { lineHeight: '20px' }],
        base: ['14px', { lineHeight: '22px' }],
      },
      borderRadius: { card: '10px' },
    },
  },
  plugins: [],
};
