import { defineConfig } from 'vite';

export default defineConfig({
    base: '/Finanzas-generales/',
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
    },
    server: {
        port: 5173,
        open: true,
    },
});
