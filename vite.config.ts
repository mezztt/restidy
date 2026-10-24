import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Restidy · by Mezztt
export default defineConfig({
  plugins: [react()],
  server: { port: 5176 },
  preview: { port: 5176 },
})
