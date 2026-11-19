-- dados de teste
insert into canais (nome) values ('WhatsApp'), ('E-mail')
on conflict (nome) do nothing;
