import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

// SWC compila los decoradores de Nest + class-validator con su metadata,
// imprescindible para que la inyección de dependencias funcione bajo Vitest.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*spec.ts', 'src/**/*spec.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
