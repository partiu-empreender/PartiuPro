-- ============================================
-- 020: FORMA DE PAGAMENTO
-- ============================================
--
-- Pedido da Tania (11/09/2026): escolher a forma de pagamento ao registrar a
-- venda.
--
-- POR QUE UMA COLUNA NOVA, E NÃO MAIS UM VALOR EM `status`
--
-- `status` responde SE pagou (`pago` / `pendente` / `cancelada`). Forma de
-- pagamento responde COMO pagou. São perguntas independentes: dá para estar
-- pendente num Pix combinado, e dá para estar pago em dinheiro.
--
-- Enfiar 'pix' e 'dinheiro' no CHECK de `status` destruiria a informação de
-- pagamento: marcar "pix" apagaria o "pendente", que é justamente o que faz a
-- aluna cobrar. É o mesmo erro que a migration 013 corrigiu ao separar entrega
-- de pagamento — e por isso este é o TERCEIRO eixo, não uma extensão do
-- primeiro.
--
-- É NULO E FICA NULO NAS VENDAS ANTIGAS
--
-- Sem default 'dinheiro' nem 'outro': não sabemos como as vendas já
-- registradas foram pagas, e inventar um valor faria um relatório de formas de
-- pagamento nascer mentindo. NULL diz "não informado", que é a verdade.

ALTER TABLE vendas_diarias
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;

-- Lista fechada, ao contrário de `how_knew` e das categorias do financeiro.
--
-- A diferença é o uso: origem de cliente e categoria de despesa são livres
-- porque servem para LER uma a uma, e cada aluna tem as suas. Forma de
-- pagamento existe para AGRUPAR — "quanto entrou por Pix este mês". Campo
-- livre viraria 'pix', 'PIX', 'Pix ' e 'pics' na mesma coluna, e o
-- agrupamento não fecharia.
--
-- 'outro' existe justamente para não travar quem recebe de um jeito que não
-- está na lista (vale-presente, permuta), sem abrir a porta para grafia solta.
ALTER TABLE vendas_diarias
  DROP CONSTRAINT IF EXISTS vendas_diarias_forma_pagamento_check;

ALTER TABLE vendas_diarias
  ADD CONSTRAINT vendas_diarias_forma_pagamento_check
  CHECK (
    forma_pagamento IS NULL
    OR forma_pagamento IN ('pix', 'dinheiro', 'credito', 'debito', 'transferencia', 'outro')
  );

COMMENT ON COLUMN vendas_diarias.forma_pagamento IS
  'COMO pagou (pix/dinheiro/credito/debito/transferencia/outro). Eixo independente de status, que diz SE pagou. NULL = não informado, inclusive nas vendas anteriores a 11/09/2026.';

-- Índice parcial: só as vendas que têm forma informada, que é o universo de
-- qualquer agrupamento por forma de pagamento. Enquanto a maioria das vendas
-- for antiga (NULL), o parcial mantém o índice pequeno.
CREATE INDEX IF NOT EXISTS idx_vendas_forma_pagamento
  ON vendas_diarias (workspace_id, forma_pagamento)
  WHERE forma_pagamento IS NOT NULL;
