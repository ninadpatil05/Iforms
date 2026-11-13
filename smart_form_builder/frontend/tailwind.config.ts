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
        sans: ['IBM Plex Sans', 'Inter', 'Space Grotesk', 'sans-serif'],
        serif: ['Source Serif 4', 'Fraunces', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        paper: {
          base: '#FAF7F0',
          'base-dark': '#1A1712',
          lowest: '#FFFFFF',
          'lowest-dark': '#14120E',
          high: '#EFECE6',
          'high-dark': '#24201A',
          card: '#F7F4EE',
          'card-dark': '#221E19',
          border: '#E6DFD3',
          'border-dark': '#332D27',
          muted: '#8A8275',
          'muted-dark': '#9E9689',
          text: '#2B2620',
          'text-dark': '#FAF7F0',
          ink: '#2B2620',
        },
        terracotta: {
          primary: '#B5502E',
          hover: '#A0451F',
          active: '#8B3A19',
          container: '#F7ECE8',
          'container-dark': '#3A231C',
          fixed: '#FCEAE4',
        },
        sage: {
          secondary: '#5B7052',
          hover: '#4C5F44',
          container: '#EAF0E8',
          'container-dark': '#232E21',
          fixed: '#D6E4D3',
        },
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '18px',
        full: '9999px',
      },
      boxShadow: {
        'warm-sm': '0 1px 3px 0 rgba(43, 38, 32, 0.06), 0 1px 2px 0 rgba(43, 38, 32, 0.04)',
        'warm-md': '0 4px 12px -2px rgba(43, 38, 32, 0.08), 0 2px 6px -1px rgba(43, 38, 32, 0.04)',
        'warm-lg': '0 12px 28px -4px rgba(43, 38, 32, 0.12), 0 4px 10px -2px rgba(43, 38, 32, 0.06)',
      },
    },
  },
  plugins: [],
} satisfies Config;
