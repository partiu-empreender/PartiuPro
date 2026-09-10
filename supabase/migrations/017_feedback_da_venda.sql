-- ============================================
-- 017: FEEDBACK PEDIDO E FEEDBACK FEITO
-- ============================================
--
-- Pedido da Tania (10/09/2026), na ficha da cliente, dentro de cada venda:
--
--   1. Pediu feedback Google ao cliente?  → [se sim] O feedback foi feito?
--   2. Pediu feedback ao presenteado?     → [se sim] Foi feito?
--
-- POR QUE DOIS BOOLEANOS POR CANAL, E NÃO UM ESTADO SÓ
--
-- São duas perguntas com donos diferentes. "Pedi" é ação da aluna, e ela sabe
-- a resposta na hora. "Foi feito" é ação do cliente, e chega depois — às vezes
-- dias depois, às vezes nunca.
--
-- Um campo único ('nao_pedido' | 'pedido' | 'feito') pareceria mais limpo e
-- perderia o caso que mais importa: pedi e não veio. É exatamente essa lista —
-- pedidos sem resposta — que diz para quem a aluna precisa cobrar. Com um
-- estado só, "pedido" e "esqueci de pedir" ficariam a um passo de distância um
-- do outro, e a cobrança viraria adivinhação.
--
-- O default FALSE é o correto: toda venda nasce sem feedback pedido.

ALTER TABLE vendas_diarias
  ADD COLUMN IF NOT EXISTS feedback_google_pedido      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS feedback_google_feito       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS feedback_presenteado_pedido BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS feedback_presenteado_feito  BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN vendas_diarias.feedback_google_pedido IS
  'A aluna pediu avaliação no Google para a cliente. Ação dela, sabida na hora.';

COMMENT ON COLUMN vendas_diarias.feedback_google_feito IS
  'A cliente de fato avaliou. Ação de outra pessoa, que chega depois — por isso é campo separado de "pedido".';

COMMENT ON COLUMN vendas_diarias.feedback_presenteado_pedido IS
  'A aluna pediu retorno de quem recebeu o presente.';

COMMENT ON COLUMN vendas_diarias.feedback_presenteado_feito IS
  'Quem recebeu de fato deu o retorno.';

-- Índice parcial só para a lista que a aluna vai olhar: pedidos ainda sem
-- resposta. É a pergunta acionável ("de quem eu preciso cobrar"), e o parcial
-- mantém o índice pequeno — a maioria das vendas nunca teve feedback pedido.
CREATE INDEX IF NOT EXISTS idx_vendas_feedback_pendente
  ON vendas_diarias (workspace_id, data)
  WHERE (feedback_google_pedido AND NOT feedback_google_feito)
     OR (feedback_presenteado_pedido AND NOT feedback_presenteado_feito);
