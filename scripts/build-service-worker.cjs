const {generateSW} = require('workbox-build');
(async () => {
  const {count,size,warnings} = await generateSW({
    globDirectory: 'dist',
    globPatterns: ['**/*.{html,js,css,json,png,ico,svg,wasm,webmanifest,ttf,woff,woff2}'],
    globIgnores: ['**/sw.js', '**/workbox-*.js'],
    swDest: 'dist/sw.js',
    navigateFallback: '/index.html',
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    skipWaiting: false,
    maximumFileSizeToCacheInBytes: 12*1024*1024,
    mode: 'production',
  });
  for (const warning of warnings) console.warn(warning);
  if (warnings.length) throw new Error('Nie wszystkie zasoby PWA trafiły do pamięci offline.');
  console.log(`PWA: zapisano ${count} zasobów offline (${(size/1024/1024).toFixed(1)} MB).`);
})().catch(error => {console.error(error);process.exitCode=1});
