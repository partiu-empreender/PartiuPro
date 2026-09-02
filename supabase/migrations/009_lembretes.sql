-- 009_lembretes.sql
-- ============================================
-- Lembretes: a agenda de contato que a Tania pediu na reunião de 27/08
-- ("tivermos uma visualização de agenda").
--
-- O ponto que decidiu o desenho: a maior parte dos lembretes NÃO é digitada
-- por ninguém. Aniversário da cliente, um ano de cadastro, três meses sem
-- comprar — tudo isso já está em `customers`. Materializar essas linhas por
-- um job diário exigiria um agendador que o projeto não tem, e criaria
-- duplicata toda vez que o job rodasse duas vezes.
--
-- Então esta tabela guarda só DUAS coisas:
--   1. os lembretes que a aluna escreveu à mão (origem = 'manual');
--   2. a marca de "já resolvi este" nos lembretes automáticos.
--
-- Os automáticos são calculados na hora da leitura, em `lib/lembretes.ts`.
-- Cada um tem uma `chave` estável (ex.: 'aniversario:<uuid>:2026'). Quando a
-- aluna marca um como feito, gravamos a linha com aquela chave; na próxima
-- leitura o gerador vê a chave já existente e usa a linha gravada no lugar do
-- candidato. Nenhum job, nenhuma duplicata, e um lembrete automático que
-- deixou de fazer sentido (a cliente comprou de novo) simplesmente para de
-- ser gerado.
-- ============================================

CREATE TABLE IF NOT EXISTS lembretes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Nulo é permitido: cabe um lembrete que não é sobre ninguém em especial
  -- ("fechar encomenda da padaria"). Se a cliente for excluída, o lembrete
  -- dela vai junto — um lembrete órfão de "ligar pra fulana" não tem uso.
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  titulo TEXT NOT NULL,
  observacao TEXT,
  -- 'manual' | 'aniversario' | 'cliente-ha-um-ano' | 'retomar-contato'
  origem TEXT NOT NULL DEFAULT 'manual',
  -- Preenchida só nos automáticos. É ela que impede o mesmo aniversário de
  -- virar dois lembretes.
  chave TEXT,
  concluido_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  -- No Postgres NULLs são distintos entre si num índice único, então todos os
  -- lembretes manuais (chave nula) convivem sem conflito, e dois automáticos
  -- com a MESMA chave continuam sendo barrados — que é exatamente a garantia
  -- que o gerador precisa.
  UNIQUE (workspace_id, chave)
);

COMMENT ON TABLE lembretes IS
  'Agenda de contato com clientes. Linhas manuais + marcas de conclusão dos lembretes automáticos calculados em lib/lembretes.ts.';

ALTER TABLE lembretes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their lembretes" ON lembretes;
CREATE POLICY "Users can read their lembretes" ON lembretes
  FOR SELECT USING (auth.uid() = workspace_id);

DROP POLICY IF EXISTS "Users can create lembretes" ON lembretes;
CREATE POLICY "Users can create lembretes" ON lembretes
  FOR INSERT WITH CHECK (auth.uid() = workspace_id);

DROP POLICY IF EXISTS "Users can update their lembretes" ON lembretes;
CREATE POLICY "Users can update their lembretes" ON lembretes
  FOR UPDATE USING (auth.uid() = workspace_id);

DROP POLICY IF EXISTS "Users can delete their lembretes" ON lembretes;
CREATE POLICY "Users can delete their lembretes" ON lembretes
  FOR DELETE USING (auth.uid() = workspace_id);

-- A tela sempre pergunta "o que tem até tal dia, na ordem da data".
CREATE INDEX IF NOT EXISTS idx_lembretes_workspace_data ON lembretes(workspace_id, data);
CREATE INDEX IF NOT EXISTS idx_lembretes_customer ON lembretes(customer_id);
