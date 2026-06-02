import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  outDir: 'dist-cli',
  banner: {
    js: '#!/usr/bin/env node',
  },
})
