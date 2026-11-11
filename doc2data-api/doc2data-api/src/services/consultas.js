import { HttpError } from '../http.js';
import { db, eq } from '../supabase.js';
import { exigirUuid } from '../util.js';

// Busca uma linha pelo id ou responde 404.
// Ex.: const doc = await buscarPorId('documentos', ctx.params.id, 'Documento');
export async function buscarPorId(tabela, id, rotulo) {
  exigirUuid(id, 'id');
  const linha = await db.buscar(tabela, { id: eq(id) });
  if (!linha) throw new HttpError(404, `${rotulo} não encontrado.`);
  return linha;
}
