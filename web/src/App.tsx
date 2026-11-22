import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { Shell } from './components/Shell'
import { Assistente } from './pages/Assistente'
import { Conferencia } from './pages/Conferencia'
import { Documento } from './pages/Documento'
import { Documentos } from './pages/Documentos'
import { Entrada } from './pages/Entrada'
import { Inicio } from './pages/Inicio'
import { Login } from './pages/Login'
import { Planilhas } from './pages/Planilhas'
import { VisaoGeral } from './pages/VisaoGeral'

export default function App() {
  const { usuario } = useAuth()
  const [acesso, setAcesso] = useState<'entrar' | 'criar' | null>(null)

  if (!usuario)
    return acesso ? (
      <Login modoInicial={acesso} aoVoltar={() => setAcesso(null)} />
    ) : (
      <Inicio aoEntrar={() => setAcesso('entrar')} aoCriarConta={() => setAcesso('criar')} />
    )

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<VisaoGeral />} />
          <Route path="entrada" element={<Entrada />} />
          <Route path="documentos" element={<Documentos />} />
          <Route path="documentos/:id" element={<Documento />} />
          <Route path="conferencia" element={<Conferencia />} />
          <Route path="assistente" element={<Assistente />} />
          <Route path="planilhas" element={<Planilhas />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
