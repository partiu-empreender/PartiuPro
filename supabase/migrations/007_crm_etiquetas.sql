-- 007_crm_etiquetas.sql
-- ============================================
-- CRM: etiquetas configuráveis e os buracos de permissão que faltavam.
--
-- A tabela `customers` já existia desde a migration inicial e está bem
-- modelada — inclusive com UNIQUE(workspace_id, phone), que serve de chave
-- natural pra deduplicar na importação de CSV e no vínculo automático da
-- venda. O que nunca existiu foi código de aplicação nem etiquetas.
--
-- Pedido da Tania na reunião de 27/08: "que já tivesse ali etiquetado esse
-- cliente — compra aniversário, Natal, datas comemorativas — e aí depois a
-- gente faz um filtro e consegue ver todos os clientes daquela etiqueta".
-- ============================================

-- ============================================
-- 1. Telefone deixa de ser obrigatório
-- ============================================
-- A Tania cadastra a cliente no momento da venda, e nem sempre tem o telefone
-- na hora. Exigir o campo faria ela digitar um número falso só pra salvar — e
-- número falso envenena justamente a chave que usamos pra deduplicar.
--
-- O UNIQUE(workspace_id, phone) continua valendo: no Postgres, NULLs são
-- considerados distintos entre si num índice único, então várias clientes sem
-- telefone convivem sem conflito, e duas com o MESMO telefone continuam sendo
-- barradas.
ALTER TABLE customers ALTER COLUMN phone DROP NOT NULL;

-- ============================================
-- 2. Permissão que faltava: excluir cliente
-- ============================================
-- `customers` tinha SELECT, INSERT e UPDATE, mas nenhuma policy de DELETE —
-- então excluir falhava silenciosamente (a linha simplesmente não sumia, sem
-- erro). Cadastro sem exclusão não é cadastro: um cliente digitado errado
-- ficaria pra sempre.
DROP POLICY IF EXISTS "Users can delete their customers" ON customers;
CREATE POLICY "Users can delete their customers" ON customers
  FOR DELETE USING (auth.uid() = workspace_id);

-- ============================================
-- 3. Etiquetas, criadas pela própria aluna
-- ============================================
-- Tabela em vez de coluna de texto porque a Tania quer renomear e recolorir
-- as etiquetas dela sem sair reescrevendo linha de cliente.
CREATE TABLE IF NOT EXISTS customer_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT 'slate',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE (workspace_id, nome)
);

COMMENT ON TABLE customer_tags IS
  'Etiquetas de cliente criadas pela aluna (aniversário, Natal, VIP, corporativo, inativo).';

-- Ligação N:N. ON DELETE CASCADE nos dois lados: apagar a etiqueta a remove de
-- todas as clientes, e apagar a cliente leva os vínculos junto.
CREATE TABLE IF NOT EXISTS customer_tag_links (
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES customer_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (customer_id, tag_id)
);

ALTER TABLE customer_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_tag_links ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. RLS
-- ============================================
-- customer_tags tem workspace_id, então compara direto com auth.uid().
DROP POLICY IF EXISTS "Users can read their customer_tags" ON customer_tags;
CREATE POLICY "Users can read their customer_tags" ON customer_tags
  FOR SELECT USING (auth.uid() = workspace_id);

DROP POLICY IF EXISTS "Users can create customer_tags" ON customer_tags;
CREATE POLICY "Users can create customer_tags" ON customer_tags
  FOR INSERT WITH CHECK (auth.uid() = workspace_id);

DROP POLICY IF EXISTS "Users can update their customer_tags" ON customer_tags;
CREATE POLICY "Users can update their customer_tags" ON customer_tags
  FOR UPDATE USING (auth.uid() = workspace_id);

DROP POLICY IF EXISTS "Users can delete their customer_tags" ON customer_tags;
CREATE POLICY "Users can delete their customer_tags" ON customer_tags
  FOR DELETE USING (auth.uid() = workspace_id);

-- customer_tag_links não tem workspace_id: a dona é alcançada pela cliente,
-- seguindo o mesmo padrão EXISTS já usado em venda_itens. O INSERT valida os
-- DOIS lados — senão daria pra pendurar a etiqueta de uma aluna na cliente de
-- outra.
DROP POLICY IF EXISTS "Users can read their customer_tag_links" ON customer_tag_links;
CREATE POLICY "Users can read their customer_tag_links" ON customer_tag_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = customer_tag_links.customer_id AND c.workspace_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create customer_tag_links" ON customer_tag_links;
CREATE POLICY "Users can create customer_tag_links" ON customer_tag_links
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = customer_tag_links.customer_id AND c.workspace_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM customer_tags t
      WHERE t.id = customer_tag_links.tag_id AND t.workspace_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their customer_tag_links" ON customer_tag_links;
CREATE POLICY "Users can delete their customer_tag_links" ON customer_tag_links
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM customers c
      WHERE c.id = customer_tag_links.customer_id AND c.workspace_id = auth.uid()
    )
  );

-- ============================================
-- 5. Índices
-- ============================================
CREATE INDEX IF NOT EXISTS idx_customer_tags_workspace ON customer_tags(workspace_id);
CREATE INDEX IF NOT EXISTS idx_customer_tag_links_tag ON customer_tag_links(tag_id);
-- Busca por nome sem diferenciar maiúscula: casa com o ILIKE 'texto%' da tela.
CREATE INDEX IF NOT EXISTS idx_customers_workspace_nome ON customers(workspace_id, lower(name));
