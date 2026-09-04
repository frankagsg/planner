import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The kiosk serves the built client from the Express server (single origin).
// In dev, Vite proxies /api to the backend on :4000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/photos': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Split heavy libs so the initial paint stays quick on the Pi.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          fullcalendar: [
            '@fullcalendar/core',
            '@fullcalendar/react',
            '@fullcalendar/daygrid',
            '@fullcalendar/timegrid',
            '@fullcalendar/list',
            '@fullcalendar/interaction',
          ],
        },
      },
    },
  },
});
