import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

// SWC compila los decoradores de Nest + class-validator con su metadata,
// imprescindible para que la inyección de dependencias funcione bajo Vitest.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*spec.ts', 'src/**/*spec.ts'],
    // Carga .env.test y aborta si el entorno resultante no parece aislado de producción —
    // ver apps/api/test/setup-test-env.ts y tasks/lessons.md.
    setupFiles: ['./test/setup-test-env.ts'],
    // Los specs *.e2e-spec.ts comparten una única BD de test (nucleo_test) y mutan las mismas
    // filas de Employee/PayrollRun — en paralelo (default de Vitest) corren de verdad a la vez
    // y compiten entre sí (lección #10). Sin transacciones por test, la única forma fiable de
    // que "la suite pasa" sea determinista es serializar los ficheros.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
