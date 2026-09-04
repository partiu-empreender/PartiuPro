-- 013_situacao_do_pedido.sql
-- Pagamento e entrega da venda: o lugar que a 010 prometeu e não criou.
--
-- Em 2026-08-31 duas etiquetas de cliente foram removidas ("Pagamento
-- pendente" e "Aguardando entrega de pedido") porque eram atributos do PEDIDO
-- pendurados na PESSOA: a etiqueta continuava lá depois do pedido pago, e na
-- segunda compra ninguém sabia mais a qual pedido ela se referia. O comentário
-- de lib/etiquetas.ts diz, com todas as letras, que "esse estado pertence à
-- venda" — e desde então não havia onde guardá-lo. É este arquivo.
--
-- POR QUE DOIS CAMPOS, E NÃO UM
--
-- A coluna `status` já existia com cinco valores num eixo só
-- (draft/pending/confirmed/delivered/cancelled). O problema é que pagamento e
-- entrega são independentes: a cliente pode ter pago e ainda não recebido, ou
-- recebido e ficado devendo. Com um campo só, marcar "entregue" apagaria a
-- informação de que ainda falta receber — justo a que faz a aluna ir cobrar.
--
-- Então `status` passa a ser só PAGAMENTO, e a entrega ganha coluna própria.
--
-- POR QUE 'draft' SAI
--
-- Todas as 79 vendas existentes estavam em 'draft' — não porque alguém as
-- marcou assim, mas porque era o DEFAULT e nenhuma tela oferecia outra coisa.
-- E nenhuma delas é rascunho: foram registradas de verdade, com item e valor.
-- Um estado que ninguém escolhe e todo mundo herda não descreve nada.
--
-- As existentes viram 'pago', que é a leitura certa: venda de cesta é paga no
-- ato na esmagadora maioria dos casos, e o histórico já foi usado como
-- faturamento realizado no Raio-X desde sempre. Quem tiver uma pendente
-- corrige na tela — é um clique, e o campo agora existe.

-- ============================================================
-- 1. Pagamento
-- ============================================================

-- Primeiro solta o CHECK antigo: os valores novos ainda não passariam por ele.
ALTER TABLE vendas_diarias DROP CONSTRAINT IF EXISTS vendas_diarias_status_check;

-- Migra o que existe. 'draft' e 'confirmed' viram 'pago'; 'pending' vira
-- 'pendente'. Os outros dois não aparecem em nenhuma linha hoje, mas a
-- conversão fica escrita pro caso de alguém ter inserido à mão.
UPDATE vendas_diarias SET status = CASE status
  WHEN 'draft'     THEN 'pago'
  WHEN 'confirmed' THEN 'pago'
  WHEN 'delivered' THEN 'pago'
  WHEN 'pending'   THEN 'pendente'
  WHEN 'cancelled' THEN 'cancelada'
  ELSE 'pago'
END;

ALTER TABLE vendas_diarias
  ALTER COLUMN status SET DEFAULT 'pago',
  ALTER COLUMN status SET NOT NULL;

-- 'pago' é o default de propósito: o caminho comum da aluna é vender e receber
-- na hora. Fazer o default ser 'pendente' encheria a lista de cobrança de
-- vendas que nunca estiveram pendentes, e ela deixaria de olhar a lista.
ALTER TABLE vendas_diarias
  ADD CONSTRAINT vendas_diarias_status_check
  CHECK (status IN ('pago', 'pendente', 'cancelada'));

-- ============================================================
-- 2. Entrega
-- ============================================================
--
-- Coluna nova, separada do pagamento pelo motivo do cabeçalho. Nasce
-- 'pendente' pra TODAS as vendas, inclusive as antigas: o sistema não tem como
-- saber o que já foi entregue, e chutar 'entregue' faria a aluna perder de
-- vista uma cesta que ainda deve sair. Errar pro lado que ela confere é o
-- lado seguro.
--
-- 'nao_aplica' existe pra quem vende no balcão e leva na hora: sem essa opção,
-- essas vendas ficariam pendentes pra sempre poluindo a agenda de entrega.

ALTER TABLE vendas_diarias
  ADD COLUMN IF NOT EXISTS entrega TEXT NOT NULL DEFAULT 'pendente';

ALTER TABLE vendas_diarias DROP CONSTRAINT IF EXISTS vendas_diarias_entrega_check;
ALTER TABLE vendas_diarias
  ADD CONSTRAINT vendas_diarias_entrega_check
  CHECK (entrega IN ('pendente', 'entregue', 'nao_aplica'));

-- ============================================================
-- 3. Índices
-- ============================================================
--
-- As duas telas que nascem disto perguntam "o que falta receber?" e "o que
-- falta entregar?", sempre dentro de uma aluna só. Índice parcial porque o
-- caso comum é estar tudo pago e entregue: indexar as linhas resolvidas seria
-- carregar peso pra responder sobre o que ninguém pergunta.

CREATE INDEX IF NOT EXISTS idx_vendas_pagamento_pendente
  ON vendas_diarias (workspace_id, data)
  WHERE status = 'pendente';

CREATE INDEX IF NOT EXISTS idx_vendas_entrega_pendente
  ON vendas_diarias (workspace_id, delivery_date)
  WHERE entrega = 'pendente';

COMMENT ON COLUMN vendas_diarias.status IS
  'Pagamento: pago | pendente | cancelada. Independente de `entrega`.';
COMMENT ON COLUMN vendas_diarias.entrega IS
  'Entrega: pendente | entregue | nao_aplica (venda levada na hora).';
