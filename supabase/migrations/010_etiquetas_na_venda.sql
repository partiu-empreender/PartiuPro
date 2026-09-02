-- 010_etiquetas_na_venda.sql
-- Etiqueta de OCASIÃO, presa à venda.
--
-- Fecha um buraco que 007_crm_etiquetas.sql abriu de propósito. Lá, cinco
-- etiquetas saíram da lista de sugestões, e duas delas ("Pagamento pendente",
-- "Aguardando entrega") saíram porque eram atributos do PEDIDO pendurados na
-- PESSOA: a etiqueta continuava lá depois do pedido pago, e na segunda compra
-- ninguém sabia mais a qual pedido ela se referia. O comentário daquele arquivo
-- diz, com todas as letras, que "esse estado pertence à venda" — e até agora
-- não existia lugar nenhum pra guardá-lo.
--
-- É esse lugar. A Tania pediu pra marcar "a venda do Rodrigo foi de
-- aniversário", que é informação da TRANSAÇÃO: a mesma cliente compra pro
-- aniversário em junho e pro Natal em dezembro, e as duas coisas são verdade
-- ao mesmo tempo sem se contradizerem.
--
-- Por que tabela nova em vez de reusar customer_tags: o vocabulário é outro.
-- "Cliente VIP" é julgamento sobre a pessoa e não faz sentido numa venda;
-- "Dia dos Namorados" é ocasião e não faz sentido pendurado na pessoa pra
-- sempre. Misturar as duas faria cada seletor oferecer metade de opções
-- inúteis. O custo é uma tabela a mais; o ganho é que nenhuma das telas mostra
-- opção que não serve.
--
-- E por que a etiqueta NÃO substitui o filtro por data comemorativa
-- (lib/datas-comemorativas.ts): quem comprou na semana do Dia das Mães o
-- sistema já sabe sozinho, pela data da venda. A etiqueta manual serve pro que
-- a data NÃO revela — o aniversário do Rodrigo é em junho e não coincide com
-- feriado nenhum. As duas convivem, e o filtro de clientes soma as duas fontes.

-- ============================================
-- 1. Etiquetas de venda
-- ============================================
CREATE TABLE IF NOT EXISTS venda_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT 'slate',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE (workspace_id, nome)
);

COMMENT ON TABLE venda_tags IS
  'Ocasião da compra (aniversário, Namorados, corporativo), criada pela aluna. Pertence à VENDA, não à cliente.';

-- ============================================
-- 2. Ligação N:N
-- ============================================
-- Várias etiquetas por venda de propósito: uma cesta pode ser presente de
-- aniversário E compra corporativa ao mesmo tempo.
CREATE TABLE IF NOT EXISTS venda_tag_links (
  venda_id UUID NOT NULL REFERENCES vendas_diarias(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES venda_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (venda_id, tag_id)
);

ALTER TABLE venda_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE venda_tag_links ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. RLS
-- ============================================
-- Mesmo desenho de 007: a tabela com workspace_id compara direto com
-- auth.uid(); a de ligação alcança a dona pela venda.
DROP POLICY IF EXISTS "Users can read their venda_tags" ON venda_tags;
CREATE POLICY "Users can read their venda_tags" ON venda_tags
  FOR SELECT USING (auth.uid() = workspace_id);

DROP POLICY IF EXISTS "Users can create venda_tags" ON venda_tags;
CREATE POLICY "Users can create venda_tags" ON venda_tags
  FOR INSERT WITH CHECK (auth.uid() = workspace_id);

DROP POLICY IF EXISTS "Users can update their venda_tags" ON venda_tags;
CREATE POLICY "Users can update their venda_tags" ON venda_tags
  FOR UPDATE USING (auth.uid() = workspace_id);

DROP POLICY IF EXISTS "Users can delete their venda_tags" ON venda_tags;
CREATE POLICY "Users can delete their venda_tags" ON venda_tags
  FOR DELETE USING (auth.uid() = workspace_id);

-- O INSERT valida OS DOIS lados — sem a segunda checagem daria pra pendurar a
-- etiqueta de uma aluna na venda de outra.
DROP POLICY IF EXISTS "Users can read their venda_tag_links" ON venda_tag_links;
CREATE POLICY "Users can read their venda_tag_links" ON venda_tag_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM vendas_diarias v
      WHERE v.id = venda_tag_links.venda_id AND v.workspace_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create venda_tag_links" ON venda_tag_links;
CREATE POLICY "Users can create venda_tag_links" ON venda_tag_links
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendas_diarias v
      WHERE v.id = venda_tag_links.venda_id AND v.workspace_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM venda_tags t
      WHERE t.id = venda_tag_links.tag_id AND t.workspace_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their venda_tag_links" ON venda_tag_links;
CREATE POLICY "Users can delete their venda_tag_links" ON venda_tag_links
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM vendas_diarias v
      WHERE v.id = venda_tag_links.venda_id AND v.workspace_id = auth.uid()
    )
  );

-- ============================================
-- 4. Índices
-- ============================================
CREATE INDEX IF NOT EXISTS idx_venda_tags_workspace ON venda_tags(workspace_id);
CREATE INDEX IF NOT EXISTS idx_venda_tag_links_tag ON venda_tag_links(tag_id);
