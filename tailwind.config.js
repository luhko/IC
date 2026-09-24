/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0d1117',
          soft: '#161b22',
          softer: '#1c2230',
        },
        edge: '#2a3140',
        ink: {
          DEFAULT: '#e6edf3',
          dim: '#9aa7b4',
          faint: '#6b7684',
        },
        accent: {
          DEFAULT: '#4dd0a7',
          soft: '#132b24',
        },
        danger: '#ff6b6b',
        warn: '#e3b341',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
