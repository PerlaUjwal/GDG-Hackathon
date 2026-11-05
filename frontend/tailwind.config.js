/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neu: {
          bg: '#e8edf3',
          card: '#e8edf3',
          dark: '#1c222d',
          darkCard: '#222834',
          accent: '#3b82f6',
          accentHover: '#2563eb',
          success: '#10b981',
          danger: '#ef4444',
          warning: '#f59e0b',
          text: '#2d3748',
          textMuted: '#64748b',
        }
      },
      boxShadow: {
        'neu-flat': '8px 8px 16px #c5cbd3, -8px -8px 16px #ffffff',
        'neu-flat-sm': '4px 4px 10px #c5cbd3, -4px -4px 10px #ffffff',
        'neu-flat-lg': '12px 12px 24px #c5cbd3, -12px -12px 24px #ffffff',
        'neu-pressed': 'inset 4px 4px 8px #c5cbd3, inset -4px -4px 8px #ffffff',
        'neu-pressed-sm': 'inset 2px 2px 5px #c5cbd3, inset -2px -2px 5px #ffffff',
        'neu-convex': 'linear-gradient(145deg, #f8ffff, #d1d5db)',
        'neu-accent': '6px 6px 14px rgba(59, 130, 246, 0.35), -6px -6px 14px rgba(255, 255, 255, 0.9)',
      }
    },
  },
  plugins: [],
}

