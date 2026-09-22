-- ============================================================
-- SQL PARA RODAR NO PAINEL DO SUPABASE (SQL Editor)
-- Projeto: vcaxpbynkamdbxwzrklo ("partiu-empreender's Project")
-- Data: 21/09/2026
-- ============================================================
--
-- São duas limpezas independentes. Rode na ordem, conferindo o resultado de
-- cada uma antes de ir para a próxima.
--
-- Eu não pude executar estes comandos: apagar muitas linhas de uma vez é uma
-- ação bloqueada para mim por segurança, e não tentei contornar.


-- ============================================================
-- PARTE 1 — ITENS DUPLICADOS (o bug das "3 Declarações")
-- ============================================================
--
-- 8 vendas ficaram com os itens duplicados porque a edição de venda apagava os
-- itens antigos sem permissão para isso, e o banco respondia "sucesso" sem
-- apagar nada. A migration 021 já corrigiu a causa; isto limpa o estrago.
--
-- A regra é conservadora: só mexe onde a CONTA PROVA a duplicação — quando
-- dividir a soma dos itens por 2, 3 ou 4 e somar o frete dá exatamente o
-- faturamento gravado da venda. Onde a conta não fecha, nada é tocado.
-- Duas unidades compradas de verdade continuam sendo duas.

-- 1.1 — CONFIRA ANTES (não apaga nada; deve listar 8 vendas)
with soma as (
  select v.id as venda_id, v.faturamento_total, coalesce(v.shipping_cost,0) as frete,
         sum(vi.subtotal) as total_itens, count(*) as linhas
  from vendas_diarias v join venda_itens vi on vi.venda_id = v.id
  group by 1,2,3
)
select s.venda_id, v.data, v.cliente_nome, s.faturamento_total,
       s.linhas as linhas_hoje, s.linhas / k as linhas_depois, k as divisor
from soma s
cross join generate_series(2,4) as k
join vendas_diarias v on v.id = s.venda_id
where round(s.total_itens / k + s.frete, 2) = round(s.faturamento_total, 2)
  and s.linhas % k = 0
order by v.data;


-- 1.2 — APAGA as linhas sobrando
-- Mantém sempre a linha que veio do catálogo (com produto_id) e a mais antiga.
with soma as (
  select v.id as venda_id, v.faturamento_total, coalesce(v.shipping_cost,0) as frete,
         sum(vi.subtotal) as total_itens, count(*) as linhas
  from vendas_diarias v join venda_itens vi on vi.venda_id = v.id
  group by 1,2,3
),
divisores as (
  select s.venda_id, k
  from soma s cross join generate_series(2,4) as k
  where round(s.total_itens / k + s.frete, 2) = round(s.faturamento_total, 2)
    and s.linhas % k = 0
),
numerada as (
  select vi.id, d.k,
         row_number() over (
           partition by vi.venda_id, vi.produto_nome, vi.quantidade, vi.subtotal
           order by (vi.produto_id is null), vi.created_at, vi.id
         ) as posicao,
         count(*) over (
           partition by vi.venda_id, vi.produto_nome, vi.quantidade, vi.subtotal
         ) as iguais
  from venda_itens vi
  join divisores d on d.venda_id = vi.venda_id
)
delete from venda_itens
where id in (select id from numerada where posicao > iguais / k);
-- Esperado: DELETE 13


-- 1.3 — CONFIRA DEPOIS (a consulta 1.1 deve voltar VAZIA)


-- ============================================================
-- PARTE 2 — CONTAS DE TESTE
-- ============================================================
--
-- Três contas de teste inflam o painel da Tania: entram na contagem de alunas
-- e somam R$ 3.391 de faturamento que não existiu.
--
--   Tania Teste  (taniateste@teste.com)      6 vendas, 7 clientes, 8 produtos
--   Teste Joao   (joaoteste@testeteste.com)  3 vendas
--   Teste01      (joao.guilherme@...)        vazia
--
-- NÃO ESTÃO NA LISTA, de propósito:
--   - pontementoring@gmail.com — é a conta ADMIN da Tania, o acesso dela ao
--     painel. Apagar tiraria o acesso.
--   - joao.marques@jpedromarques.com.br — é a SUA conta, com 5 vendas. Se for
--     teste também, descomente o bloco 2.3 no fim.

-- 2.1 — CONFIRA ANTES
select u.email, u.full_name,
       (select count(*) from vendas_diarias v where v.workspace_id = u.id) as vendas,
       (select count(*) from customers   c where c.workspace_id = u.id) as clientes
from public.users u
where u.id in (
  '2c7e1889-0b14-43cf-b84a-ef2a64ef1bf7',
  'b60ca4e0-6cc9-4491-bfa8-4059b2973ebd',
  'e2f9043f-3a61-499f-8a14-d33b514e5872'
);


-- 2.2 — APAGA as três contas de teste
-- Uma linha só: tudo o que pertence à conta (vendas, itens, clientes,
-- produtos, metas, etiquetas) vai junto pelo ON DELETE CASCADE.
delete from auth.users
where id in (
  '2c7e1889-0b14-43cf-b84a-ef2a64ef1bf7',  -- Tania Teste
  'b60ca4e0-6cc9-4491-bfa8-4059b2973ebd',  -- Teste Joao
  'e2f9043f-3a61-499f-8a14-d33b514e5872'   -- Teste01
);
-- Esperado: DELETE 3


-- 2.3 — OPCIONAL: sua conta de testes.
-- Descomente SÓ se você não quiser mais os dados dela (5 vendas, 5 clientes).
-- delete from auth.users where id = 'ac4e5507-959e-4b26-bfe7-4c813f1c8554';


-- 2.4 — CONFIRA DEPOIS (deve cair de 117 para 114)
select count(*) as alunas from public.users;
