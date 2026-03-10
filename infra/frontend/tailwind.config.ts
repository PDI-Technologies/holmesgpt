/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pdi: {
          indigo: '#07003d',
          sky: '#29b5e8',
          orange: '#ff5100',
          sun: '#ffb71b',
          grass: '#029f50',
          plum: '#a1007d',
          ocean: '#1226aa',
          'cool-gray': '#d6d8d6',
          slate: '#8e9c9c',
          granite: '#323e48',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
