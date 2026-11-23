-- dados de teste (mesmos códigos usados pelo complementar.sql e pelo front)
insert into canais (nome, descricao) values
  ('whatsapp', 'Recebido por WhatsApp'),
  ('email',    'Recebido por e-mail')
on conflict (nome) do nothing;
