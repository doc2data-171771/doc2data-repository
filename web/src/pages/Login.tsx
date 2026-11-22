import { useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { MODO_DEMO } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Botao, Entrada, Logo, Rotulo, mensagemDe } from '../components/ui'

type Modo = 'entrar' | 'criar'

export function Login({ modoInicial = 'entrar', aoVoltar }: { modoInicial?: Modo; aoVoltar?: () => void }) {
  const { entrar, registrar } = useAuth()
  const [modo, setModo] = useState<Modo>(modoInicial)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState(MODO_DEMO && modoInicial === 'entrar' ? 'marina@exemplo.com' : '')
  const [senha, setSenha] = useState(MODO_DEMO && modoInicial === 'entrar' ? 'demonstracao' : '')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const criando = modo === 'criar'

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (criando && senha.length < 8) return setErro('A senha deve ter pelo menos 8 caracteres')
    setEnviando(true)
    try {
      if (criando) await registrar(nome.trim(), email.trim(), senha)
      else await entrar(email.trim(), senha)
    } catch (err) {
      setErro(mensagemDe(err))
    } finally {
      setEnviando(false)
    }
  }

  function trocar(m: Modo) {
    setModo(m)
    setErro(null)
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-12 bg-paper relative overflow-hidden">
      {/* brilho suave atrás do formulário */}
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[420px] rounded-full bg-stamp/15 blur-[120px]" />

      {aoVoltar && (
        <button onClick={aoVoltar} className="absolute top-4 left-4 inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink px-2 h-8 rounded-[6px] hover:bg-sunk">
          <ArrowLeft className="size-4" /> Voltar
        </button>
      )}

      <div className="relative w-full max-w-[360px]">
        <div className="flex justify-center mb-8">
          <Logo tamanho="lg" />
        </div>

        <h1 className="text-center text-[20px] font-semibold tracking-[-0.02em]">{criando ? 'Crie sua conta' : 'Entre no doc2data'}</h1>
        <p className="text-center text-[13.5px] text-ink-3 mt-1.5 mb-7">
          {criando ? 'Seus documentos ficam só na sua conta.' : 'Bom te ver de novo.'}
        </p>

        <form onSubmit={enviar} className="space-y-4" noValidate>
          {criando && (
            <div>
              <Rotulo htmlFor="nome">Nome</Rotulo>
              <Entrada id="nome" autoComplete="name" required value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
            </div>
          )}
          <div>
            <Rotulo htmlFor="email">E-mail</Rotulo>
            <Entrada id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus={!criando} />
          </div>
          <div>
            <Rotulo htmlFor="senha" extra={criando ? <span className="font-normal text-ink-3">mínimo 8 caracteres</span> : undefined}>
              Senha
            </Rotulo>
            <Entrada
              id="senha"
              type="password"
              autoComplete={criando ? 'new-password' : 'current-password'}
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>

          {erro && (
            <p role="alert" className="text-[13px] text-err bg-err-soft border border-err/25 rounded-[6px] px-3 py-2">
              {erro}
            </p>
          )}

          <Botao type="submit" variante="primario" className="w-full h-9" carregando={enviando} disabled={!email || !senha || (criando && !nome.trim())}>
            {criando ? 'Criar conta' : 'Entrar'} <ArrowRight className="size-4" />
          </Botao>
        </form>

        <p className="text-center text-[13px] text-ink-3 mt-6">
          {criando ? 'Já tem conta? ' : 'Ainda não tem conta? '}
          <button type="button" onClick={() => trocar(criando ? 'entrar' : 'criar')} className="text-ink font-medium hover:text-stamp">
            {criando ? 'Entrar' : 'Criar conta'}
          </button>
        </p>

        {MODO_DEMO && <p className="text-center text-[12px] text-ink-3 mt-6 leading-relaxed">Modo demonstração: qualquer senha funciona e nada é salvo.</p>}
      </div>
    </div>
  )
}
