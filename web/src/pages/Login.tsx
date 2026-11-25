import { useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { MODO_DEMO } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Botao, Entrada, Modal, Rotulo, mensagemDe } from '../components/ui'

type Modo = 'entrar' | 'criar'

export function Login({ modoInicial = 'entrar', aoFechar }: { modoInicial?: Modo; aoFechar: () => void }) {
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
    <Modal aberto aoFechar={aoFechar} titulo={criando ? 'Crie sua conta' : 'Entre no doc2data'}>
      <div className="mx-auto w-full max-w-[360px]">
        <p className="text-[13.5px] text-ink-3 mb-5">{criando ? 'Seus documentos ficam só na sua conta.' : 'Bom te ver de novo.'}</p>

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
    </Modal>
  )
}
