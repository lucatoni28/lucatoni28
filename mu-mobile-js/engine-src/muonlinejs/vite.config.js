import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [],
  build: {
    target: 'es2022',
    minify: false,
    assetsInlineLimit: 0, //disable
    cssTarget: 'chrome100',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          bjs: [
            '@babylonjs/core',
            '@babylonjs/loaders',
            '@babylonjs/materials',
          ],
        },
      },
    },
  },
  define: {
    APP_VERSION: JSON.stringify(process.env.npm_package_version),
    APP_STAGE: JSON.stringify(process.env.APP_ENV || 'unk'),
    QA_ENABLED: JSON.stringify(process.env.QA ? 'true' : ''),
    'import.meta.env.QA_ENABLED': JSON.stringify(
      process.env.QA ? 'TEST MODE ENABLED' : ''
    ),
  },
  optimizeDeps: {
    force: true,
  },
});
