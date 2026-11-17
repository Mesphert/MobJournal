const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.js'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        surface2: token('surface-2'),
        line: token('line'),
        ink: token('ink'),
        muted: token('muted'),
        accent: token('accent'),
        win: token('win'),
        loss: token('loss'),
        be: token('be'),
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
