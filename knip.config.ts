import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  workspaces: {
    'apps/web': {
      entry: ['src/main.tsx'],
    },
    'libs/ui': {
      entry: ['src/index.ts'],
    },
    'libs/shared': {
      entry: ['src/index.ts'],
    },
  },
};

export default config;
