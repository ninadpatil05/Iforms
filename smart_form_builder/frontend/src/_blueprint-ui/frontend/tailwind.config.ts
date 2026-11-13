import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        paper: {
          base: '#F6F4EF',
          'base-dark': '#12141A',
          card: '#DCD7CC',
          'card-dark': '#1D2020',
          muted: '#9C9B8F',
          text: '#3A3F3C',
          'text-dark': '#F6F4EF',
          ink: '#1D2B3A',
        },
      },
      borderRadius: {
        DEFAULT: '4px',
        sm: '4px',
        md: '4px',
        lg: '4px',
        xl: '4px',
        '2xl': '4px',
        '3xl': '4px',
        full: '9999px',
      },
      transitionTimingFunction: {
        DEFAULT: 'ease-out',
      },
      transitionDuration: {
        DEFAULT: '160ms',
      },
    },
  },
  plugins: [],
} satisfies Config;
