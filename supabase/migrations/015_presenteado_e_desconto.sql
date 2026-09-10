-- ============================================
-- 015: PRESENTEADO E DESCONTO NA VENDA
-- ============================================
--
-- Pedido da Tania (10/09/2026). Duas coisas diferentes na mesma migration
-- porque ambas pertencem à venda e entram na mesma tela.
--
-- ============================================
-- O PRESENTEADO
-- ============================================
--
-- Quem compra e quem recebe raramente são a mesma pessoa neste negócio: o
-- produto é cesta de presente. Até aqui só existia o comprador, então "para
-- quem foi" vivia nas observações, em texto solto que nada consegue ler.
--
-- Fica em `vendas_diarias` e NÃO vira uma tabela de pessoas, de propósito. O
-- presenteado não tem relação com a aluna — tem relação com AQUELA entrega.
-- Modelá-lo como cadastro criaria um segundo banco de pessoas para manter,
-- deduplicar e apagar, para uma entidade que aparece uma vez e não volta.
--
-- ATENÇÃO — LGPD. Estes campos guardam dados de alguém que não é usuária da
-- plataforma e não consentiu com nada. A política atual (lib/legal.ts, item 5)
-- diz à aluna para NÃO registrar telefone e endereço de terceiros. O texto foi
-- ajustado junto com esta migration, mas a decisão de negócio é da Tania:
-- coletar contato de presenteado é uma escolha dela, não uma consequência
-- técnica. Se ela recuar, estas três colunas saem — e é por isso que são
-- soltas aqui, sem tabela nem índice: remover é um DROP COLUMN.

ALTER TABLE vendas_diarias
  ADD COLUMN IF NOT EXISTS presenteado_nome      TEXT,
  ADD COLUMN IF NOT EXISTS presenteado_contato   TEXT,
  ADD COLUMN IF NOT EXISTS presenteado_endereco  TEXT;

COMMENT ON COLUMN vendas_diarias.presenteado_nome IS
  'Quem RECEBE o presente, quando não é a própria cliente. Dado de terceiro: ver item 5 da política de privacidade.';

COMMENT ON COLUMN vendas_diarias.presenteado_contato IS
  'Telefone do presenteado, para avisar da entrega. Dado de terceiro que não consentiu — coletar é opção da aluna.';

COMMENT ON COLUMN vendas_diarias.presenteado_endereco IS
  'Endereço de entrega do presente. Não confunde com customers.endereco, que é onde a CLIENTE mora.';

-- ============================================
-- O DESCONTO
-- ============================================
--
-- Guardamos o PERCENTUAL, e não só o valor final com desconto já aplicado.
--
-- Sem esta coluna, uma cesta de 100 vendida a 90 fica indistinguível de uma
-- cesta que sempre custou 90 — e a aluna perde a única pergunta que importa:
-- quanto ela deu de desconto no mês. Guardar só o valor final apaga a
-- informação no instante em que ela é registrada.
--
-- `faturamento_total` continua sendo o que ENTROU de fato, com o desconto já
-- descontado: é o número que precisa bater com o dinheiro na conta. O
-- percentual fica ao lado, para responder "quanto abri mão".

ALTER TABLE vendas_diarias
  ADD COLUMN IF NOT EXISTS desconto_percentual NUMERIC(5,2) DEFAULT 0;

-- O CHECK é a rede de segurança: 0 a 100. Sem ele, um desconto de 150% viraria
-- faturamento negativo, e o Raio-X passaria a subtrair vendas.
ALTER TABLE vendas_diarias
  DROP CONSTRAINT IF EXISTS vendas_diarias_desconto_valido;

ALTER TABLE vendas_diarias
  ADD CONSTRAINT vendas_diarias_desconto_valido
  CHECK (desconto_percentual >= 0 AND desconto_percentual <= 100);

COMMENT ON COLUMN vendas_diarias.desconto_percentual IS
  'Percentual de desconto aplicado (0 a 100). O faturamento_total JÁ vem com ele descontado; esta coluna existe para saber quanto se abriu mão.';
