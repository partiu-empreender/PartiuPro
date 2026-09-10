-- ============================================
-- 018: ATENDIMENTOS COM NOME, TELEFONE E ORIGEM
-- ============================================
--
-- Pedido da Tania (10/09/2026): registrar atendimentos com nome, telefone,
-- data do contato e origem.
--
-- O QUE EXISTIA, E POR QUE NÃO FOI SUBSTITUÍDO
--
-- `atendimentos_diarios` guarda uma CONTAGEM por dia ("atendi 12 pessoas"),
-- e é dela que saem a taxa de conversão (vendas ÷ atendimentos) e o PA. Não
-- há nome nem telefone: é um número por data.
--
-- A escolha (confirmada com o João em 10/09) foi acrescentar o registro
-- nominal MANTENDO a contagem, e não trocar um pelo outro. O motivo é que a
-- contagem já tem histórico: as alunas vêm registrando esse número, e a
-- conversão de meses passados depende dele. Substituir deixaria esses
-- registros órfãos e quebraria o histórico no meio.
--
-- COMO OS DOIS CONVIVEM
--
-- A tabela nova guarda uma linha por pessoa atendida. A contagem do dia passa
-- a ser: o que foi digitado na contagem simples OU o número de linhas
-- nominais daquele dia, o que for MAIOR.
--
-- O "maior" não é arbitrário — é o que impede os dois caminhos de brigarem.
-- Quem registra 12 na contagem e depois anota 3 pessoas nominalmente atendeu
-- 12, não 3: as outras 9 ela simplesmente não detalhou. Somar daria 15 e
-- inflaria a conversão; usar só o nominal apagaria 9 atendimentos reais.
-- Essa regra vive em lib/atendimentos.ts, com teste.

CREATE TABLE IF NOT EXISTS atendimentos_pessoas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data         DATE NOT NULL DEFAULT CURRENT_DATE,
  nome         TEXT NOT NULL,
  telefone     TEXT,
  ddi          TEXT NOT NULL DEFAULT '55',
  -- De onde a pessoa veio: Instagram, indicação, feira. Campo livre pelo mesmo
  -- motivo de customers.how_knew — fechar num select obrigaria quem vende em
  -- bazar a marcar "Outros" e perder a informação.
  origem       TEXT,
  observacao   TEXT,
  -- Vira venda? Preenchido quando o atendimento se converte. Fica NULL na
  -- maioria dos casos, e é exatamente essa proporção que interessa.
  venda_id     UUID REFERENCES vendas_diarias(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE atendimentos_pessoas IS
  'Atendimentos nominais. Convive com atendimentos_diarios (contagem simples): a contagem do dia é o MAIOR entre os dois, ver lib/atendimentos.ts.';

COMMENT ON COLUMN atendimentos_pessoas.venda_id IS
  'Preenchido quando o atendimento virou venda. NULL na maioria — a proporção é o dado.';

-- Índice pela dupla que toda consulta usa: o workspace e o dia.
CREATE INDEX IF NOT EXISTS idx_atendimentos_pessoas_dia
  ON atendimentos_pessoas (workspace_id, data DESC);

ALTER TABLE atendimentos_pessoas ENABLE ROW LEVEL SECURITY;

-- Uma policy por operação, seguindo o padrão do resto do projeto: `FOR ALL`
-- economiza linhas e esconde qual operação foi liberada por engano.
CREATE POLICY "Users can read their atendimentos_pessoas" ON atendimentos_pessoas
  FOR SELECT USING (workspace_id = auth.uid());

CREATE POLICY "Users can create their atendimentos_pessoas" ON atendimentos_pessoas
  FOR INSERT WITH CHECK (workspace_id = auth.uid());

CREATE POLICY "Users can update their atendimentos_pessoas" ON atendimentos_pessoas
  FOR UPDATE USING (workspace_id = auth.uid());

CREATE POLICY "Users can delete their atendimentos_pessoas" ON atendimentos_pessoas
  FOR DELETE USING (workspace_id = auth.uid());
