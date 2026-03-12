import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spotifyPlugin } from './server/spotify.js'

export default defineConfig({
  plugins: [react(), spotifyPlugin()],
})
