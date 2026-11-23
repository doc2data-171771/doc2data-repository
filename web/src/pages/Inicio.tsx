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
      <div aria-hidden className="aurora pointer-events-none absolute -top-[360px] left-1/2 -translate-x-1/2 w-[1500px] h-[1000px] max-w-none rounded-full blur-[110px]" />

      <header className="relative flex items-center justify-between px-6 sm:px-12 h-16">
        <Logo />
        <div className="flex items-center gap-2">
          <Botao variante="fantasma" onClick={aoEntrar}>Entrar</Botao>
          <Botao variante="primario" onClick={aoCriarConta}>Criar conta</Botao>
        </div>
      </header>

      <main className="relative flex-1 px-6 sm:px-12">
        <section className="max-w-[960px] mx-auto pt-20 sm:pt-36 pb-20 sm:pb-28 text-center">
          <p className="inline-flex items-center gap-2 h-8 px-3.5 rounded-full border border-rule-strong bg-sheet/60 backdrop-blur text-[13px] text-ink-2">
            <Sparkles className="size-3.5 text-stamp" /> Novo: assistente que analisa os seus documentos
          </p>
          <h1 className="mt-8 text-[44px] sm:text-[72px] lg:text-[84px] leading-[1] font-semibold tracking-[-0.045em] bg-gradient-to-b from-ink to-ink-2 bg-clip-text text-transparent text-balance">
            Documentos viram dados conferidos.
          </h1>
          <p className="mt-7 text-[17px] sm:text-[20px] text-ink-2 max-w-[54ch] mx-auto leading-relaxed text-pretty">
            Envie notas, boletos e comprovantes. A IA extrai os dados, você confere e depois exporta ou pede uma análise. Cada conta
            vê apenas os próprios documentos.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Botao variante="primario" className="h-11 px-5 text-[14px]" onClick={aoCriarConta}>
              Começar <ArrowRight className="size-4" />
            </Botao>
            <Botao className="h-11 px-5 text-[14px]" onClick={aoEntrar}>Já tenho conta</Botao>
          </div>
        </section>

        <section className="max-w-[1200px] mx-auto grid gap-px bg-rule border border-rule rounded-[14px] overflow-hidden sm:grid-cols-2 lg:grid-cols-4 mb-24">
          {PASSOS.map((p, i) => (
            <div key={p.titulo} className="bg-sheet/85 backdrop-blur p-7 sm:p-8">
              <div className="flex items-center gap-2.5 text-ink-3">
                <span className="grid place-items-center size-8 rounded-[8px] bg-stamp-soft text-stamp [&>svg]:size-4">{p.icone}</span>
                <span className="font-mono text-[11px]">0{i + 1}</span>
              </div>
              <p className="mt-5 text-[16px] font-medium">{p.titulo}</p>
              <p className="mt-1.5 text-[14px] text-ink-2 leading-snug">{p.texto}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="relative px-6 sm:px-12 py-6 border-t border-rule text-xs text-ink-3">doc2data · MVP de automação documental</footer>
    </div>
  )
}
