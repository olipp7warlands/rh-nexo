import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Sigue el PORT real de la API (dotenv-cli/turbo ya lo cargan en process.env antes de esto),
// en vez de asumir 3000 — ese puerto puede estar ocupado por otro proyecto en la máquina.
const apiPort = process.env.PORT || '3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': `http://localhost:${apiPort}` },
  },
});
