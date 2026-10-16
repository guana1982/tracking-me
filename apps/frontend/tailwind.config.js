/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Elegant pastel budget colors
        needs: {
          50: '#ECFDF5',   // Soft mint background
          100: '#D1FAE5',  // Light mint
          200: '#A7F3D0',  // Mint
          500: '#10B981',  // Emerald - elegant green
          600: '#059669',  // Darker emerald
          700: '#047857',  // Deep emerald
        },
        wants: {
          50: '#FFF7ED',   // Soft peach background
          100: '#FFEDD5',  // Light peach
          200: '#FED7AA',  // Peach
          500: '#F59E0B',  // Amber - warm elegant
          600: '#D97706',  // Darker amber
          700: '#B45309',  // Deep amber
        },
        savings: {
          50: '#EFF6FF',   // Soft sky background
          100: '#DBEAFE',  // Light sky
          200: '#BFDBFE',  // Sky
          500: '#3B82F6',  // Blue - clean and modern
          600: '#2563EB',  // Darker blue
          700: '#1D4ED8',  // Deep blue
        },
      },
    },
  },
  plugins: [],
};
