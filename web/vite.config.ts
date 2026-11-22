import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd()), ...process.env }
  // Sem VITE_API_URL o front chama o próprio domínio e a Vercel responde 405 no login.
  if (command === 'build' && env.VITE_MOCK !== 'true' && !env.VITE_API_URL) {
    throw new Error('VITE_API_URL não definida. Na Vercel: Settings → Environment Variables → VITE_API_URL=https://<sua-api>.vercel.app e faça Redeploy.')
  }
  return { plugins: [react(), tailwindcss()] }
})
