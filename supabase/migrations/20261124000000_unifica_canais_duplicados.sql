-- Unifica canais cadastrados duas vezes com grafias diferentes
-- ("E-mail" do seed.sql e "email" do complementar.sql; idem "WhatsApp"/"whatsapp").
-- Os documentos passam para o canal com o código padrão e o duplicado é apagado.

insert into canais (nome, descricao) values
  ('email',    'Recebido por e-mail'),
  ('whatsapp', 'Recebido por WhatsApp')
on conflict (nome) do nothing;

with pares(antigo, novo) as (
  values ('E-mail', 'email'), ('WhatsApp', 'whatsapp')
)
update documentos d
set canal_id = n.id
from pares p
join canais a on a.nome = p.antigo
join canais n on n.nome = p.novo
where d.canal_id = a.id;

delete from canais where nome in ('E-mail', 'WhatsApp');
