
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';

export default defineConfig(({ mode }) => {
  // Fix: Property 'cwd' does not exist on type 'Process' - resolved by importing from node:process
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY),
      'process.env.VITE_API_KEY': JSON.stringify(env.VITE_API_KEY || process.env.VITE_API_KEY),
    }
  };
});
