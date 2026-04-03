import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    define: {
      // Makes process.env available in some edge cases
      __APP_VERSION__: JSON.stringify('1.0.0'),
    },
    server: {
      // Bind all interfaces + allow any Host header (needed for mDNS like mypc.local, tunnels, some phones)
      host: '0.0.0.0',
      port: 5173,
      strictPort: false,
      allowedHosts: true,
      // Proxy API calls to backend in development (avoids CORS; use VITE_API_URL=/api in dev)
      proxy: mode === 'development' ? {
        '/api': {
          target: (() => {
            const base = env.VITE_API_URL || '';
            if (!base || base.startsWith('/')) return 'http://localhost:5000';
            return base.replace(/\/?api\/?$/, '') || 'http://localhost:5000';
          })(),
          changeOrigin: true,
        }
      } : {},
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      strictPort: false,
      allowedHosts: true,
    },
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'axios'],
          }
        }
      }
    }
  }
})
