import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  esbuild: {
    // esbuild transpiles TS without type checking — errors won't block the build
    tsconfigRaw: {
      compilerOptions: {
        skipLibCheck: true,
      },
    },
  },
})
