import { randomUUID } from 'node:crypto';
import { HttpError } from './http.js';

export const novoId = () => randomUUID();
export const agora = () => new Date().toISOString();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ehUuid = (valor) => typeof valor === 'string' && UUID.test(valor);

// Garante que o valor é um id válido. Protege o banco de ids malformados.
export function exigirUuid(valor, campo) {
  if (!ehUuid(valor)) throw new HttpError(400, `"${campo}" deve ser um id (UUID) válido.`);
  return valor;
}

// Tira acentos e caracteres estranhos do nome do arquivo (o Storage não gosta deles).
export function nomeSeguro(nome) {
  const limpo = String(nome)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^[._]+/, '')
    .slice(-100);
  return limpo || 'arquivo';
}

// Descobre o tipo REAL do arquivo olhando os primeiros bytes
// (não confiamos no tipo que o navegador diz, pois ele pode ser falso).
export function detectarMime(buffer) {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
    return 'application/pdf';
  }
  const assinaturaPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(assinaturaPng)) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  return null;
}

// ?limite=20&offset=0  (padrão 20, máximo 100)
export function lerPaginacao(query) {
  const limite = Math.min(Math.max(parseInt(query.get('limite') ?? '', 10) || 20, 1), 100);
  const offset = Math.max(parseInt(query.get('offset') ?? '', 10) || 0, 0);
  return { limite, offset };
}
