import { ArrowRight, FileUp, ScanLine, Sheet, Sparkles } from 'lucide-react'
import { Botao, Logo } from '../components/ui'

const PASSOS = [
  { icone: <FileUp />, titulo: 'Envie', texto: 'PDFs e imagens, um a um ou em lote.' },
  { icone: <Sparkles />, titulo: 'A IA lê', texto: 'Os campos são extraídos e recebem uma nota de confiança.' },
  { icone: <ScanLine />, titulo: 'Você confere', texto: 'Aprove, corrija ou rejeite com o original ao lado.' },
  { icone: <Sheet />, titulo: 'Exporte ou pergunte', texto: 'Baixe em XLSX/CSV ou peça à IA uma análise dos seus dados.' },
]

/** Página pública: o que é a ferramenta, antes do login. */
export function Inicio({ aoEntrar, aoCriarConta }: { aoEntrar: () => void; aoCriarConta: () => void }) {
  return (
    <div className="min-h-dvh flex flex-col bg-paper relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-56 left-1/2 -translate-x-1/2 w-[1000px] h-[560px] rounded-full bg-stamp/15 blur-[140px]" />

      <header className="relative flex items-center justify-between px-6 sm:px-10 h-14 border-b border-rule">
        <Logo />
        <div className="flex items-center gap-2">
          <Botao tamanho="sm" variante="fantasma" onClick={aoEntrar}>Entrar</Botao>
          <Botao tamanho="sm" variante="primario" onClick={aoCriarConta}>Criar conta</Botao>
        </div>
      </header>

      <main className="relative flex-1 px-6 sm:px-10">
        <section className="max-w-[760px] mx-auto pt-24 pb-16 text-center">
          <p className="inline-flex items-center gap-2 h-7 px-3 rounded-full border border-rule-strong bg-sheet/60 text-[12px] text-ink-2">
            <Sparkles className="size-3.5 text-stamp" /> Novo: assistente que analisa os seus documentos
          </p>
          <h1 className="mt-6 text-[40px] sm:text-[60px] leading-[1.02] font-semibold tracking-[-0.04em] bg-gradient-to-b from-ink to-ink-2 bg-clip-text text-transparent">
            Documentos viram dados conferidos.
          </h1>
          <p className="mt-5 text-[17px] text-ink-2 max-w-[52ch] mx-auto leading-relaxed">
            Envie notas, boletos e comprovantes. A IA extrai os dados, você confere e depois exporta ou pede uma análise. Cada conta
            vê apenas os próprios documentos.
          </p>
          <div className="mt-8 flex items-center justify-center gap-2">
            <Botao variante="primario" className="h-10 px-4" onClick={aoCriarConta}>
              Começar <ArrowRight className="size-4" />
            </Botao>
            <Botao className="h-10 px-4" onClick={aoEntrar}>Já tenho conta</Botao>
          </div>
        </section>

        <section className="max-w-[1040px] mx-auto grid gap-px bg-rule border border-rule rounded-[12px] overflow-hidden sm:grid-cols-2 lg:grid-cols-4 mb-20">
          {PASSOS.map((p, i) => (
            <div key={p.titulo} className="bg-sheet p-6">
              <div className="flex items-center gap-2 text-ink-3 [&>svg]:size-4">
                {p.icone}
                <span className="font-mono text-[11px]">0{i + 1}</span>
              </div>
              <p className="mt-4 font-medium">{p.titulo}</p>
              <p className="mt-1 text-[13px] text-ink-2 leading-snug">{p.texto}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="relative px-6 sm:px-10 py-6 border-t border-rule text-xs text-ink-3">doc2data · MVP de automação documental</footer>
    </div>
  )
}
