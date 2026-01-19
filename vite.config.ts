
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Specifically define individual env vars to ensure they are replaced correctly during build
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
    'process.env': process.env
  }
});
