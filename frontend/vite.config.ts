import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = env.VITE_DEV_API_PROXY ?? 'http://127.0.0.1:3030'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
      alias: {
        '@': path.resolve(__dirname, './src'),
        react: path.resolve(__dirname, './node_modules/react'),
        'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
        'react/jsx-runtime': path.resolve(__dirname, './node_modules/react/jsx-runtime'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      watch: {
        // Reliable file watching inside Docker (especially on macOS)
        usePolling: env.CHOKIDAR_USEPOLLING === 'true',
      },
      hmr: {
        host: 'localhost',
        port: 5173,
      },
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
