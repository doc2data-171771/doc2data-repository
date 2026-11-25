import type { ReactNode } from 'react'
import { ArrowRight, Bot, Check, Clock, FolderOpen, Lock, Pencil, ShieldCheck, X } from 'lucide-react'
import { Botao } from '../components/ui'

/** "Saiba mais" da página inicial: como a ferramenta ajuda, com ilustrações feitas da própria interface. */
export function SaibaMais({ aoCriarConta }: { aoCriarConta: () => void }) {
  return (
    <div id="saiba-mais" className="max-w-[1120px] mx-auto scroll-mt-8">
      <header className="text-center max-w-[640px] mx-auto">
        <p className="text-[13px] font-medium text-ciano">Saiba mais</p>
        <h2 className="mt-3 text-[32px] sm:text-[44px] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
          Chega de copiar nota por nota para a planilha.
        </h2>
        <p className="mt-5 text-[16px] sm:text-[17px] text-ink-2 leading-relaxed text-pretty">
          O doc2data faz a parte chata: lê o documento, preenche os campos e organiza tudo. Você só confere e decide.
        </p>
      </header>

      <div className="mt-20 sm:mt-28 space-y-24 sm:space-y-32">
        <Explicacao
          numero="1"
          etapa="Leitura"
          cor="text-ciano"
          titulo="A IA lê o documento por você"
          texto="Envie o PDF ou uma foto do celular. A IA encontra emissor, CNPJ, valor, data e vencimento, e diz o quanto tem certeza de cada campo."
          itens={['Notas fiscais, boletos e comprovantes', 'Vários arquivos de uma vez', 'Nota de confiança em cada campo']}
          ilustracao={<IlustracaoLeitura />}
        />
        <Explicacao
          invertido
          numero="2"
          etapa="Conferência"
          cor="text-warn"
          titulo="Você só olha o que precisa de atenção"
          texto="Campos com confiança baixa aparecem destacados. Compare com o original ao lado, corrija se for preciso e aprove com um clique."
          itens={['Original e campos lado a lado', 'Dúvidas aparecem em destaque', 'Nada vai para a planilha sem a sua aprovação']}
          ilustracao={<IlustracaoConferencia />}
        />
        <Explicacao
          numero="3"
          etapa="Resultado"
          cor="text-rosa"
          titulo="Planilha pronta ou resposta direta"
          texto="Baixe os documentos aprovados em XLSX ou CSV, ou pergunte ao assistente sobre os seus gastos, como faria com um colega."
          itens={['Exportação em XLSX e CSV', 'Perguntas em português, sobre os seus dados', 'Cada conta vê só os próprios documentos']}
          ilustracao={<IlustracaoResultado />}
        />
      </div>

      <section className="mt-28 sm:mt-36">
        <h2 className="text-center text-[28px] sm:text-[36px] font-semibold tracking-[-0.03em]">Por que usar o doc2data</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFICIOS.map((b) => (
            <div key={b.titulo} className="rounded-[14px] border border-rule bg-sheet/80 p-6 transition-transform duration-200 hover:-translate-y-0.5 hover:border-rule-strong">
              <span className={`grid place-items-center size-10 rounded-[10px] [&>svg]:size-5 ${b.cor}`}>{b.icone}</span>
              <p className="mt-5 text-[16px] font-medium">{b.titulo}</p>
              <p className="mt-1.5 text-[14px] text-ink-2 leading-snug">{b.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-28 sm:mt-36 mb-24 rounded-[18px] p-px bg-gradient-to-r from-ciano via-stamp to-rosa">
        <div className="rounded-[17px] bg-sheet px-6 py-14 sm:py-16 text-center relative overflow-hidden">
          <div aria-hidden className="aurora pointer-events-none absolute -bottom-64 left-1/2 -translate-x-1/2 w-[900px] h-[500px] max-w-none rounded-full blur-[90px] opacity-60" />
          <div className="relative">
            <h2 className="text-[28px] sm:text-[40px] font-semibold tracking-[-0.035em] text-balance">Comece pelo primeiro documento.</h2>
            <p className="mt-4 text-[16px] text-ink-2 max-w-[44ch] mx-auto">Crie a conta, envie um PDF e veja os campos aparecerem preenchidos.</p>
            <Botao variante="primario" className="mt-8 h-11 px-5 text-[14px]" onClick={aoCriarConta}>
              Criar minha conta <ArrowRight className="size-4" />
            </Botao>
          </div>
        </div>
      </section>
    </div>
  )
}

const BENEFICIOS = [
  { icone: <Clock />, cor: 'bg-ciano/15 text-ciano', titulo: 'Menos digitação', texto: 'Os campos chegam preenchidos. Você revisa em vez de digitar.' },
  { icone: <ShieldCheck />, cor: 'bg-ok/15 text-ok', titulo: 'Menos erro', texto: 'Cada campo tem nota de confiança, e só entra na planilha o que você aprovou.' },
  { icone: <FolderOpen />, cor: 'bg-warn/15 text-warn', titulo: 'Tudo num lugar', texto: 'Notas, boletos e comprovantes organizados por status, fáceis de achar.' },
  { icone: <Lock />, cor: 'bg-rosa/15 text-rosa', titulo: 'Só você vê', texto: 'Cada conta vê apenas os próprios documentos.' },
]

function Explicacao({ numero, etapa, cor, titulo, texto, itens, ilustracao, invertido }: { numero: string; etapa: string; cor: string; titulo: string; texto: string; itens: string[]; ilustracao: ReactNode; invertido?: boolean }) {
  return (
    <section className="grid gap-10 lg:gap-16 lg:grid-cols-2 items-center">
      <div className={invertido ? 'lg:order-2' : ''}>
        <p className={`font-mono text-[12px] ${cor}`}>
          0{numero} · {etapa}
        </p>
        <h3 className="mt-3 text-[26px] sm:text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance">{titulo}</h3>
        <p className="mt-4 text-[16px] text-ink-2 leading-relaxed">{texto}</p>
        <ul className="mt-6 space-y-2.5">
          {itens.map((i) => (
            <li key={i} className="flex items-center gap-2.5 text-[14.5px] text-ink-2">
              <Check className={`size-4 shrink-0 ${cor}`} /> {i}
            </li>
          ))}
        </ul>
      </div>
      {ilustracao}
    </section>
  )
}

/** Moldura de janela de app para as ilustrações. */
function Janela({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div aria-hidden className="rounded-[14px] border border-rule-strong bg-sheet shadow-2xl shadow-black/40 overflow-hidden transition-transform duration-300 hover:-translate-y-1">
      <div className="flex items-center gap-1.5 px-4 h-9 border-b border-rule bg-sunk/60">
        <span className="size-2.5 rounded-full bg-err/70" />
        <span className="size-2.5 rounded-full bg-warn/70" />
        <span className="size-2.5 rounded-full bg-ok/70" />
        <span className="ml-3 font-mono text-[11px] text-ink-3">{titulo}</span>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  )
}

function Papel({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-[8px] bg-[#f4f1ea] p-3.5 space-y-2 ${className}`}>
      <div className="h-2 w-1/2 rounded bg-[#2a2a2a]/70" />
      <div className="h-1.5 w-3/4 rounded bg-[#2a2a2a]/25" />
      <div className="h-1.5 w-2/3 rounded bg-[#2a2a2a]/25" />
      <div className="pt-2 space-y-1.5">
        {[80, 60, 70, 50].map((w) => (
          <div key={w} className="h-1.5 rounded bg-[#2a2a2a]/20" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="pt-2 flex justify-between items-end">
        <div className="h-1.5 w-1/4 rounded bg-[#2a2a2a]/30" />
        <div className="h-3 w-1/3 rounded bg-[#5e6ad2]/70" />
      </div>
    </div>
  )
}

function Campo({ rotulo, valor, confianca, tom }: { rotulo: string; valor: string; confianca: string; tom: 'ok' | 'warn' }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-[8px] border px-3 py-2 ${tom === 'ok' ? 'border-rule' : 'border-warn/50 bg-warn/10'}`}>
      <div className="min-w-0">
        <p className="text-[10.5px] text-ink-3">{rotulo}</p>
        <p className="text-[13px] font-medium truncate tnum">{valor}</p>
      </div>
      <span className={`shrink-0 font-mono text-[10.5px] px-1.5 py-0.5 rounded ${tom === 'ok' ? 'bg-ok/15 text-ok' : 'bg-warn/15 text-warn'}`}>{confianca}</span>
    </div>
  )
}

function IlustracaoLeitura() {
  return (
    <Janela titulo="conta-energia-outubro.pdf">
      <div className="grid grid-cols-[1fr_auto_1.3fr] items-center gap-3 sm:gap-5">
        <div className="scanline rounded-[8px]">
          <Papel />
        </div>
        <div className="relative w-8 sm:w-12 h-px bg-gradient-to-r from-ciano/30 to-stamp overflow-hidden">
          <span className="correr absolute inset-y-[-1px] left-0 w-1/4 bg-ciano" />
        </div>
        <div className="space-y-2 min-w-0">
          <Campo rotulo="Emissor" valor="Energia Sul" confianca="98%" tom="ok" />
          <Campo rotulo="Valor" valor="R$ 248,90" confianca="99%" tom="ok" />
          <Campo rotulo="Vencimento" valor="18/11/2026" confianca="95%" tom="ok" />
        </div>
      </div>
    </Janela>
  )
}

function IlustracaoConferencia() {
  return (
    <Janela titulo="Conferência · 3 de 6">
      <div className="grid grid-cols-[0.8fr_1.2fr] gap-4 sm:gap-5">
        <Papel className="self-start" />
        <div className="space-y-2 min-w-0">
          <Campo rotulo="CNPJ" valor="12.345.678/0001-90" confianca="97%" tom="ok" />
          <div className="relative">
            <Campo rotulo="Data de emissão" valor="1?/10/2026" confianca="62%" tom="warn" />
            <span className="absolute -right-1.5 -top-1.5 grid place-items-center size-5 rounded-full bg-warn text-paper">
              <Pencil className="size-3" />
            </span>
          </div>
          <Campo rotulo="Valor" valor="R$ 1.320,00" confianca="96%" tom="ok" />
          <div className="flex gap-2 pt-1.5">
            <span className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-[7px] bg-ok/15 text-ok text-[12px] font-medium">
              <Check className="size-3.5" /> Aprovar
            </span>
            <span className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-[7px] border border-rule-strong text-ink-3 text-[12px]">
              <X className="size-3.5" /> Rejeitar
            </span>
          </div>
        </div>
      </div>
    </Janela>
  )
}

function IlustracaoResultado() {
  const linhas = [
    ['Energia Sul', '18/11', 'R$ 248,90'],
    ['Água Cidade', '20/11', 'R$ 96,40'],
    ['Mendes Tavares', '22/11', 'R$ 1.320,00'],
  ]
  return (
    <Janela titulo="planilha-novembro.xlsx">
      <div className="rounded-[8px] border border-rule overflow-hidden text-[12px]">
        <div className="grid grid-cols-[1.4fr_0.8fr_1fr] bg-ok/10 text-ok font-medium">
          {['Emissor', 'Venc.', 'Valor'].map((c) => (
            <span key={c} className="px-3 py-2">{c}</span>
          ))}
        </div>
        {linhas.map((l) => (
          <div key={l[0]} className="grid grid-cols-[1.4fr_0.8fr_1fr] border-t border-rule text-ink-2 tnum">
            {l.map((c) => (
              <span key={c} className="px-3 py-2 truncate">{c}</span>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        <p className="ml-auto w-fit max-w-[85%] rounded-[12px] rounded-br-[4px] bg-stamp text-white px-3 py-2 text-[12.5px]">Quanto gastei com contas de consumo em novembro?</p>
        <div className="flex gap-2 items-start">
          <span className="grid place-items-center size-6 shrink-0 rounded-full bg-rosa/15 text-rosa">
            <Bot className="size-3.5" />
          </span>
          <p className="max-w-[85%] rounded-[12px] rounded-tl-[4px] bg-sunk px-3 py-2 text-[12.5px] text-ink-2">
            Foram <span className="text-ink font-medium">R$ 345,30</span> em energia e água, 2 documentos aprovados.
          </p>
        </div>
      </div>
    </Janela>
  )
}
