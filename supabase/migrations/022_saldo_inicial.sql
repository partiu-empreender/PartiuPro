-- ============================================
-- 022: SALDO INICIAL DO MÊS (saldo em caixa)
-- ============================================
--
-- Pedido das alunas (out/2026): "comecei a alimentar o app em agosto e já
-- tinha um saldo em conta. Se tivesse como informar esse saldo, as contas
-- iriam fechar melhor: iniciei com X, vendi Y, saiu Z, saldo do mês".
--
-- O DRE (migration 019) responde quanto o negócio LUCROU. Não responde quanto
-- DINHEIRO ela tem, porque não sabe de onde ela partiu. Este é o dado que
-- falta: o saldo da conta no INÍCIO de um mês.
--
-- POR QUE POR MÊS, E NÃO UM VALOR ÚNICO NA CONTA
--
-- Um campo único resolveria "comecei em agosto". Mas o saldo calculado nunca
-- bate 100% com o extrato — uma despesa esquecida, um dinheiro pessoal que
-- entrou —, e a aluna precisa poder corrigir a partir de um mês sem reescrever
-- o passado. Cada linha aqui é um ponto de partida; o mês sem linha herda o
-- saldo final do mês anterior (cálculo em lib/saldo.ts).
--
-- Só o valor informado é gravado. O saldo dos meses seguintes é DERIVADO a
-- cada consulta, pelo mesmo motivo de o DRE não ser materializado: vendas são
-- editáveis, e um saldo guardado viraria uma foto desatualizada.

CREATE TABLE IF NOT EXISTS saldos_iniciais (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ano          INTEGER NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
  mes          INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  -- Pode ser negativo: conta no vermelho é saldo real, e recusar obrigaria a
  -- aluna a mentir para conseguir começar.
  valor        NUMERIC(12,2) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  -- Um saldo inicial por mês. É a chave do UPSERT da rota: informar de novo
  -- substitui, não soma.
  UNIQUE (workspace_id, ano, mes)
);

COMMENT ON TABLE saldos_iniciais IS
  'Saldo em conta no início de um mês, informado pela aluna. Os meses sem linha herdam o saldo final do anterior (lib/saldo.ts).';

ALTER TABLE saldos_iniciais ENABLE ROW LEVEL SECURITY;

-- As quatro políticas, desde o início. A 021 existe porque `venda_itens`
-- nasceu sem DELETE e a edição falhava calada.
CREATE POLICY "Users can read their saldos" ON saldos_iniciais
  FOR SELECT USING (workspace_id = auth.uid());

CREATE POLICY "Users can create their saldos" ON saldos_iniciais
  FOR INSERT WITH CHECK (workspace_id = auth.uid());

CREATE POLICY "Users can update their saldos" ON saldos_iniciais
  FOR UPDATE USING (workspace_id = auth.uid()) WITH CHECK (workspace_id = auth.uid());

CREATE POLICY "Users can delete their saldos" ON saldos_iniciais
  FOR DELETE USING (workspace_id = auth.uid());
