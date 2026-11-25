import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, FileUp, ScanLine, Sheet, Sparkles } from 'lucide-react'
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

      <header className="relative flex items-center justify-between px-6 sm:px-12 h-20">
        <Logo tamanho="lg" />
        <div className="flex items-center gap-2.5">
          <Botao variante="fantasma" className="h-10 px-4 text-[14px]" onClick={aoEntrar}>Entrar</Botao>
          <Botao variante="primario" className="h-10 px-4 text-[14px]" onClick={aoCriarConta}>Criar conta</Botao>
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

        <Carrossel />
      </main>

      <footer className="relative px-6 sm:px-12 py-6 border-t border-rule text-xs text-ink-3">doc2data · MVP de automação documental</footer>
    </div>
  )
}

/** Os passos em carrossel: setas, bolinhas, deslizar no toque e avanço automático. */
function Carrossel() {
  const inicioToque = useRef<number | null>(null)
  const [atual, setAtual] = useState(0)
  const [pausado, setPausado] = useState(false)

  const irPara = (i: number) => setAtual((i + PASSOS.length) % PASSOS.length)

  useEffect(() => {
    if (pausado || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => irPara(atual + 1), 5000)
    return () => clearInterval(id)
  }, [atual, pausado])

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Como funciona"
      className="max-w-[760px] mx-auto mb-24"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      <div className="relative border border-rule rounded-[14px] overflow-hidden bg-sheet/85 backdrop-blur">
        <div
          onPointerDown={(e) => (inicioToque.current = e.clientX)}
          onPointerUp={(e) => {
            const dx = e.clientX - (inicioToque.current ?? e.clientX)
            inicioToque.current = null
            if (Math.abs(dx) > 40) irPara(atual + (dx < 0 ? 1 : -1))
          }}
          style={{ transform: `translateX(-${atual * 100}%)` }}
          className="flex touch-pan-y transition-transform duration-500 ease-out motion-reduce:transition-none"
        >
          {PASSOS.map((p, i) => (
            <div
              key={p.titulo}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} de ${PASSOS.length}`}
              aria-hidden={i !== atual}
              className="w-full shrink-0 px-8 sm:px-16 py-10 sm:py-12 text-center"
            >
              <span className="mx-auto grid place-items-center size-12 rounded-[10px] bg-stamp-soft text-stamp [&>svg]:size-6">{p.icone}</span>
              <p className="mt-4 font-mono text-[11px] text-ink-3">0{i + 1} / 0{PASSOS.length}</p>
              <p className="mt-3 text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em]">{p.titulo}</p>
              <p className="mt-2 text-[15px] sm:text-[16px] text-ink-2 leading-relaxed max-w-[42ch] mx-auto">{p.texto}</p>
            </div>
          ))}
        </div>
        <button onClick={() => irPara(atual - 1)} aria-label="Passo anterior" className="absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center size-9 rounded-full border border-rule-strong bg-paper/70 text-ink-2 hover:text-ink">
          <ChevronLeft className="size-4" />
        </button>
        <button onClick={() => irPara(atual + 1)} aria-label="Próximo passo" className="absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center size-9 rounded-full border border-rule-strong bg-paper/70 text-ink-2 hover:text-ink">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="mt-5 flex justify-center gap-2">
        {PASSOS.map((p, i) => (
          <button
            key={p.titulo}
            onClick={() => irPara(i)}
            aria-label={`Ir para o passo ${i + 1}: ${p.titulo}`}
            aria-current={i === atual}
            className={`h-1.5 rounded-full transition-all ${i === atual ? 'w-6 bg-stamp' : 'w-1.5 bg-rule-strong hover:bg-ink-3'}`}
          />
        ))}
      </div>
    </section>
  )
}
