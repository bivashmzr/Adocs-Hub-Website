import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize bundle size and reduce unused JS
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Core React libraries - loaded first
          if (id.includes('node_modules/react/') || 
              id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          
          // Convex libraries - can be loaded later
          if (id.includes('node_modules/convex/')) {
            return 'vendor-convex';
          }
          
          // UI components - can be loaded later
          if (id.includes('node_modules/sonner/') || 
              id.includes('node_modules/@radix-ui/')) {
            return 'vendor-ui';
          }
          
          // HTML Canvas libraries - load only when needed
          if (id.includes('node_modules/html2canvas/')) {
            return 'vendor-canvas';
          }
        }
      }
    },
    chunkSizeWarningLimit: 600,
    // Minimize 
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true,
        passes: 2
      }
    },
    // Optimize for mobile
    target: 'es2015',
    cssCodeSplit: true,
    assetsInlineLimit: 4096, // Inline small files
    sourcemap: false
  }
});
