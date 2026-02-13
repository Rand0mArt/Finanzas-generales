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
    define: {
        // Supabase public anon key — safe to expose (RLS protects data)
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://pwvudnaueupwbhfprmyg.supabase.co'),
        'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3dnVkbmF1ZXVwd2JoZnBybXlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1ODMyNTMsImV4cCI6MjA4NjE1OTI1M30.KcER7BEPPoClh5LKpNxO6axrtAoXNDnERJOZy1jpsjE'),
    },
});
