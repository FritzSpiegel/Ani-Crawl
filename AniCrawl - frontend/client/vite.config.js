import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const apiPort = env.VITE_API_PORT ? Number(env.VITE_API_PORT) : 4000;
    return {
        plugins: [react()],
        server: {
            port: 5173,
            proxy: {
                '/auth': `http://localhost:${apiPort}`,
                '/watchlist': `http://localhost:${apiPort}`,
                '/admin': `http://localhost:${apiPort}`,
                '/ext': `http://localhost:${apiPort}`
            }
        }
    }
});
