-- 006_produto_vs_adicional.sql
-- ============================================
-- Separa PRODUTO de ADICIONAL no catálogo e na venda.
--
-- Pedido da Tania na reunião de 27/08/2026: ela vende a cesta (produto) e
-- junto um buquê, um arranjo, uma orquídea (adicional). Quer medir a
-- performance dos adicionais separadamente — quanto do faturamento veio de
-- cada categoria e um ranking por categoria — pra enxergar oportunidade
-- perdida ("os adicionais representaram só 1% do faturamento").
--
-- DECISÃO DE MODELAGEM
-- Já existe uma tabela `product_additionals` no banco, herdada do esqueleto de
-- e-commerce que nunca foi ligado. Ela NÃO serve aqui, por dois motivos:
--   1. Amarra o adicional a UM produto (FK product_id). A Tania vende a mesma
--      orquídea junto de qualquer cesta — o adicional é item de catálogo
--      próprio, não modificador de um produto específico.
--   2. Não tem workspace_id e está com RLS ligada sem nenhuma policy, o que
--      faz qualquer consulta a ela voltar vazia silenciosamente.
-- Por isso o tipo entra como coluna em `products`: mesmo cadastro, mesma tela,
-- mesma RLS que já funciona, só com uma classificação a mais.
--
-- POR QUE O TIPO TAMBÉM VAI EM venda_itens
-- É um retrato do momento da venda. Se a Tania um dia reclassificar "orquídea"
-- de adicional pra produto, os relatórios dos meses passados não podem mudar
-- retroativamente — o histórico tem que continuar contando o que de fato foi
-- vendido naquele mês.
-- ============================================

-- 1. Classificação no catálogo
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'produto'
  CHECK (tipo IN ('produto', 'adicional'));

COMMENT ON COLUMN products.tipo IS
  'produto = item principal (cesta, tábua de frios). adicional = item vendido junto (buquê, arranjo, orquídea).';

-- 2. Retrato do tipo no item da venda
ALTER TABLE venda_itens
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'produto'
  CHECK (tipo IN ('produto', 'adicional'));

COMMENT ON COLUMN venda_itens.tipo IS
  'Cópia do products.tipo no momento da venda. Não seguir o catálogo: reclassificar um item não pode reescrever o histórico.';

-- 3. Alinha o histórico existente com o catálogo atual.
--    Hoje tudo é 'produto' (nada foi cadastrado como adicional ainda), mas
--    a migration precisa estar correta se rodar depois de já haver dados.
UPDATE venda_itens vi
SET tipo = p.tipo
FROM products p
WHERE vi.produto_id = p.id
  AND vi.tipo IS DISTINCT FROM p.tipo;

-- 4. Índices pros dois caminhos de leitura novos:
--    catálogo filtrado por tipo, e ranking por tipo dentro do período.
CREATE INDEX IF NOT EXISTS idx_products_workspace_tipo ON products(workspace_id, tipo);
CREATE INDEX IF NOT EXISTS idx_venda_itens_tipo ON venda_itens(tipo);

-- 5. Marca o esqueleto morto, pra ninguém confundir com o recurso acima.
COMMENT ON TABLE product_additionals IS
  'NÃO USADA. Resquício do e-commerce nunca ligado (RLS habilitada, zero policies). O recurso de adicionais vive em products.tipo — ver migration 006.';
