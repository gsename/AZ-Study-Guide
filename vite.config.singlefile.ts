import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Produces one fully self-contained dist-single/index.html (JS + CSS inlined,
// no external <script type="module"> or <link> references) so it can be
// opened directly via file:// — a plain "double-click to run" build, for
// sharing with someone who won't run a local server.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: {
    outDir: 'dist-single',
    emptyOutDir: true,
    cssCodeSplit: false,
  },
})
