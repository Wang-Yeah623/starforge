import { defineConfig } from 'tsup'

// Bundles the GitHub Action into a single committed file (dist-action/index.js)
// so it can run directly via `uses: Wang-Yeah623/starforge@<ref>`.
export default defineConfig({
  entry: { index: 'src/action/index.ts' },
  format: ['esm'],
  dts: false,
  clean: true,
  outDir: 'dist-action',
  target: 'node20',
})
