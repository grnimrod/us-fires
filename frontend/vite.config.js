import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  build: {
    assetsDir: "static",
  },
  server: {
    port: 3000,
    cors: true,
    proxy: {
      "/api": {
        target: "http://localhost:5000/",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
