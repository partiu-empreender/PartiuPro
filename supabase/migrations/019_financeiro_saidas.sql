-- ============================================
-- 019: FINANCEIRO — SAÍDAS E DRE
-- ============================================
--
-- Pedido da Tania (10/09/2026): registrar as saídas por categoria (insumos,
-- internet, aluguel) e ver o DRE.
--
-- POR QUE UMA TABELA DE SAÍDAS, E NÃO UM CAMPO DE "DESPESA" NA VENDA
--
-- Boa parte do que a aluna gasta não pertence a nenhuma venda: internet,
-- aluguel e ferramentas acontecem no mês inteiro, vendendo ela ou não.
-- Pendurar isso numa venda obrigaria a inventar rateio, e o rateio inventado é
-- pior que despesa nenhuma — dá ar de precisão a um número escolhido.
--
-- O custo que PERTENCE à venda já existe e continua onde está: `products.cost`,
-- o custo do produto. O DRE usa os dois, em linhas diferentes, e é justamente
-- essa separação que o torna legível.
--
-- ============================================
-- SOBRE O DRE
-- ============================================
--
-- Não há tabela de DRE, de propósito. Ele é 100% derivado: faturamento vem de
-- `vendas_diarias`, o custo dos produtos vem de `venda_itens` × `products.cost`,
-- e as despesas vêm daqui. Materializar o resultado criaria um número que pode
-- divergir da sua própria origem no momento em que qualquer venda for editada
-- ou cancelada — e vendas agora SÃO editáveis (etapa 1).

CREATE TABLE IF NOT EXISTS saidas_financeiras (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data         DATE NOT NULL DEFAULT CURRENT_DATE,
  descricao    TEXT NOT NULL,
  valor        NUMERIC(10,2) NOT NULL,
  -- Categoria livre com sugestões na tela, e não ENUM: fechar a lista
  -- obrigaria quem tem uma despesa fora do previsto a marcar "Outros" e perder
  -- a informação — mesmo motivo de customers.how_knew.
  categoria    TEXT NOT NULL DEFAULT 'Outros',
  -- Despesa que se repete todo mês (aluguel, internet). Não gera lançamento
  -- automático: serve para a aluna reconhecer o que é fixo quando olha o mês.
  recorrente   BOOLEAN NOT NULL DEFAULT FALSE,
  observacao   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Valor negativo aqui viraria "receita" disfarçada de despesa e faria o lucro
-- subir a cada gasto registrado. O CHECK é a rede que impede isso.
ALTER TABLE saidas_financeiras
  DROP CONSTRAINT IF EXISTS saidas_financeiras_valor_positivo;

ALTER TABLE saidas_financeiras
  ADD CONSTRAINT saidas_financeiras_valor_positivo CHECK (valor > 0);

COMMENT ON TABLE saidas_financeiras IS
  'Despesas do negócio. O custo do PRODUTO não vem daqui — vem de products.cost, e o DRE mostra os dois em linhas separadas.';

COMMENT ON COLUMN saidas_financeiras.recorrente IS
  'Marca despesa fixa. Não gera lançamento automático: é rótulo para leitura.';

-- O índice cobre a consulta que a tela faz: as saídas de um mês.
CREATE INDEX IF NOT EXISTS idx_saidas_financeiras_periodo
  ON saidas_financeiras (workspace_id, data DESC);

ALTER TABLE saidas_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their saidas" ON saidas_financeiras
  FOR SELECT USING (workspace_id = auth.uid());

CREATE POLICY "Users can create their saidas" ON saidas_financeiras
  FOR INSERT WITH CHECK (workspace_id = auth.uid());

CREATE POLICY "Users can update their saidas" ON saidas_financeiras
  FOR UPDATE USING (workspace_id = auth.uid());

CREATE POLICY "Users can delete their saidas" ON saidas_financeiras
  FOR DELETE USING (workspace_id = auth.uid());
