-- 002_atendimentos_metas.sql
-- Adiciona atendimentos_diarios (base da conversão) e metas (meta mensal de
-- faturamento). Segue o mesmo padrão de 001_init_corrigido.sql: workspace_id
-- = auth.uid() (dono), RLS com policy por operação.

-- ============================================
-- ATENDIMENTOS DIÁRIOS
-- ============================================
-- Pessoas abordadas por dia, mesmo quem não comprou. Base do cálculo de
-- conversão (vendas ÷ atendimentos) e do PA (itens vendidos ÷ atendimentos).

CREATE TABLE atendimentos_diarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES users(id),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  pessoas_atendidas INTEGER NOT NULL DEFAULT 0 CHECK (pessoas_atendidas >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE (workspace_id, data)
);

CREATE INDEX idx_atendimentos_workspace_data ON atendimentos_diarios(workspace_id, data DESC);

ALTER TABLE atendimentos_diarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their atendimentos" ON atendimentos_diarios
  FOR SELECT USING (auth.uid() = workspace_id);
CREATE POLICY "Users can create atendimentos" ON atendimentos_diarios
  FOR INSERT WITH CHECK (auth.uid() = workspace_id);
CREATE POLICY "Users can update their atendimentos" ON atendimentos_diarios
  FOR UPDATE USING (auth.uid() = workspace_id);
CREATE POLICY "Users can delete their atendimentos" ON atendimentos_diarios
  FOR DELETE USING (auth.uid() = workspace_id);

-- ============================================
-- METAS MENSAIS
-- ============================================

CREATE TABLE metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES users(id),
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER NOT NULL,
  meta_mensal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE (workspace_id, mes, ano)
);

CREATE INDEX idx_metas_workspace_ano ON metas(workspace_id, ano DESC);

ALTER TABLE metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their metas" ON metas
  FOR SELECT USING (auth.uid() = workspace_id);
CREATE POLICY "Users can create metas" ON metas
  FOR INSERT WITH CHECK (auth.uid() = workspace_id);
CREATE POLICY "Users can update their metas" ON metas
  FOR UPDATE USING (auth.uid() = workspace_id);
CREATE POLICY "Users can delete their metas" ON metas
  FOR DELETE USING (auth.uid() = workspace_id);
