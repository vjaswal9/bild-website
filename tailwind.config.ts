import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Rich gold — deeper, more premium than bright yellow-orange
        gold: {
          50:  '#fdf8f0',   // warm cream — page background
          100: '#faefd9',
          200: '#f4d99b',
          400: '#e0a135',
          500: '#C8861A',   // primary button colour — rich burnished gold
          600: '#a86a10',
          700: '#7d4e0a',
        },
        // Keep saffron alias pointing to gold for backward compat
        saffron: {
          50:  '#fdf8f0',
          100: '#faefd9',
          200: '#f4d99b',
          400: '#e0a135',
          500: '#C8861A',
          600: '#a86a10',
          700: '#7d4e0a',
        },
        // Deep Indian red — secondary accent
        ruby: {
          500: '#9B2335',
          600: '#7e1c2b',
        },
        charcoal: {
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
        cream: '#fdf8f0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      animation: {
        'fade-up': 'fadeUp 0.6s ease-out forwards',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
  ],
}
export default config
