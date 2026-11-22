import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Download, FileQuestion, Loader2, RotateCw, ZoomIn, ZoomOut } from 'lucide-react'

/**
 * Mostra o arquivo original ao lado dos campos.
 * A URL assinada da API força download (Content-Disposition), então baixamos
 * o arquivo como blob e exibimos por uma URL local — funciona para PDF e imagem.
 */
export function Visualizador({ url, mime, nome, lendo }: { url: string | null; mime: string; nome: string; lendo?: boolean }) {
  const [local, setLocal] = useState<string | null>(null)
  const [erro, setErro] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [giro, setGiro] = useState(0)
  const ehPdf = mime === 'application/pdf'

  useEffect(() => {
    setZoom(1)
    setGiro(0)
    setErro(false)
    setLocal(null)
    if (!url) return
    // URLs locais (blob:, data:) já podem ser exibidas direto
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      setLocal(url)
      return
    }
    let cancelado = false
    let criada: string | null = null
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.blob()
      })
      .then((b) => {
        if (cancelado) return
        criada = URL.createObjectURL(new Blob([b], { type: mime }))
        setLocal(criada)
      })
      .catch(() => !cancelado && setErro(true))
    return () => {
      cancelado = true
      if (criada) URL.revokeObjectURL(criada)
    }
  }, [url, mime])

  return (
    <div className="flex flex-col h-full min-h-[520px] rounded-[10px] border border-rule bg-sunk overflow-hidden">
      <div className="flex items-center gap-1 px-3 h-11 border-b border-rule bg-sheet">
        <span className="font-mono text-[11px] text-ink-3 truncate flex-1" title={nome}>
          {nome}
        </span>
        {!ehPdf && local && (
          <>
            <button className="p-1.5 rounded hover:bg-sunk text-ink-2" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} aria-label="Diminuir zoom">
              <ZoomOut className="size-4" />
            </button>
            <span className="font-mono text-[11px] w-10 text-center tnum text-ink-3">{Math.round(zoom * 100)}%</span>
            <button className="p-1.5 rounded hover:bg-sunk text-ink-2" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} aria-label="Aumentar zoom">
              <ZoomIn className="size-4" />
            </button>
            <button className="p-1.5 rounded hover:bg-sunk text-ink-2" onClick={() => setGiro((g) => (g + 90) % 360)} aria-label="Girar">
              <RotateCw className="size-4" />
            </button>
          </>
        )}
        {local && (
          <a href={local} download={nome} className="p-1.5 rounded hover:bg-sunk text-ink-2" aria-label="Baixar original" title="Baixar original">
            <Download className="size-4" />
          </a>
        )}
      </div>

      <div className={clsx('relative flex-1 overflow-auto grid place-items-center p-4', lendo && 'scanline')}>
        {!url || erro ? (
          <div className="text-center text-ink-3 text-sm max-w-[32ch]">
            <FileQuestion className="size-8 mx-auto mb-3 opacity-60" />
            {erro ? 'Não foi possível abrir o arquivo original.' : 'O arquivo original ainda não está disponível.'}
          </div>
        ) : !local ? (
          <Loader2 className="size-5 animate-spin text-ink-3" />
        ) : ehPdf ? (
          <iframe src={local} title={`Original: ${nome}`} className="absolute inset-0 w-full h-full bg-sheet" />
        ) : (
          <img
            src={local}
            alt={`Original: ${nome}`}
            className="max-w-full shadow-[0_8px_30px_-8px_rgba(0,0,0,0.25)] transition-transform origin-center"
            style={{ transform: `scale(${zoom}) rotate(${giro}deg)` }}
          />
        )}
      </div>
    </div>
  )
}
