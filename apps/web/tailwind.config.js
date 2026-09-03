const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
const { join } = require('path');

module.exports = {
  content: [
    join(__dirname, 'src/**/*.{js,ts,jsx,tsx,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ["'Georgia'", "'Times New Roman'", 'serif'],
      },
    },
  },
  plugins: [],
};
