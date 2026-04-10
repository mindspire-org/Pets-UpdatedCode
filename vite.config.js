import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Use relative base when building so Electron can load assets via file:// protocol
  base: mode === 'production' ? './' : '/',
}))
