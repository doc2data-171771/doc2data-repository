import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { ApiError, MODO_DEMO, usarBackend } from './lib/api'
import { AuthProvider } from './lib/auth'
import { ProcessadorProvider } from './lib/processador'
import { AvisosProvider } from './components/ui'

// O backend fictício só entra no pacote quando VITE_MOCK=true
if (MODO_DEMO) usarBackend((await import('./lib/mock')).criarMock())

// Tema salvo (antes do primeiro desenho, para não piscar)
try {
  const tema = localStorage.getItem('doc2data.tema')
  const escuro = tema ? tema === 'escuro' : true // escuro por padrão, como o Linear
  document.documentElement.classList.toggle('dark', escuro)
} catch {
  /* ignora */
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: true,
      // Não insiste em erros do cliente (401, 403, 404…)
      retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AvisosProvider>
        <AuthProvider>
          <ProcessadorProvider>
            <App />
          </ProcessadorProvider>
        </AuthProvider>
      </AvisosProvider>
    </QueryClientProvider>
  </StrictMode>,
)
