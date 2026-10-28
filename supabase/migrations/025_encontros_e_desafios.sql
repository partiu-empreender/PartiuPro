-- ============================================
-- 025: ENCONTROS (AGENDA) E DESAFIOS (MÃO NA MASSA)
-- ============================================
--
-- Marco 1 do cronograma (out/2026), itens 1.8 e 1.9:
--   - Agenda: calendário com os encontros da mentoria e as datas comerciais.
--   - Mão na Massa: a Tânia publica desafios, a aluna cumpre as tarefas.
--
-- SÓ TABELAS NOVAS. Nenhuma tabela existente é alterada, e nada é apagado.
--
-- QUEM ESCREVE
--
-- Encontros e desafios são da EQUIPE, não da aluna: não há policy de
-- INSERT/UPDATE/DELETE para eles. Quem grava é o painel admin, pelas rotas
-- /api/admin/*, que conferem is_admin e usam a service_role (que ignora RLS).
-- Assim, uma aluna com a chave anon na mão não consegue criar nem mudar um
-- encontro — só ler.
--
-- O progresso no desafio é da ALUNA: cada uma lê e marca só o dela.
--
-- Para desfazer (só em último caso, perde o conteúdo publicado): remover as
-- quatro tabelas, nesta ordem — desafio_progresso, desafio_tarefas, desafios,
-- encontros. Pelo SQL Editor do Supabase, à mão.

-- --------------------------------------------
-- Encontros da mentoria
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS encontros (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo          TEXT NOT NULL CHECK (length(trim(titulo)) > 0),
  descricao       TEXT,
  -- Instante de início, com fuso. A tela de cadastro manda o horário de
  -- Brasília; a de leitura formata de volta em America/Sao_Paulo.
  inicio          TIMESTAMPTZ NOT NULL,
  duracao_minutos INTEGER NOT NULL DEFAULT 60 CHECK (duracao_minutos BETWEEN 5 AND 600),
  -- Link da sala ao vivo (Zoom, Meet...). Opcional: às vezes só se sabe na hora.
  link            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS encontros_inicio_idx ON encontros (inicio);

COMMENT ON TABLE encontros IS
  'Encontros da mentoria, cadastrados pela equipe no painel admin. Toda aluna logada lê; só a service_role escreve.';

ALTER TABLE encontros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alunas leem os encontros" ON encontros
  FOR SELECT TO authenticated USING (true);

-- --------------------------------------------
-- Desafios (Mão na Massa)
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS desafios (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo     TEXT NOT NULL CHECK (length(trim(titulo)) > 0),
  descricao  TEXT,
  -- O desafio aparece para as alunas a partir de `inicio`, se publicado.
  inicio     DATE NOT NULL DEFAULT (timezone('America/Sao_Paulo', now()))::date,
  -- Prazo. Opcional: há desafio que não tem data pra acabar.
  fim        DATE,
  -- Rascunho até a Tânia publicar. Aluna nunca vê rascunho (ver policy).
  publicado  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CHECK (fim IS NULL OR fim >= inicio)
);

CREATE TABLE IF NOT EXISTS desafio_tarefas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  desafio_id UUID NOT NULL REFERENCES desafios(id) ON DELETE CASCADE,
  ordem      INTEGER NOT NULL DEFAULT 0,
  texto      TEXT NOT NULL CHECK (length(trim(texto)) > 0)
);

CREATE INDEX IF NOT EXISTS desafio_tarefas_desafio_idx ON desafio_tarefas (desafio_id, ordem);

-- Uma linha por tarefa feita. Desmarcar apaga a linha.
CREATE TABLE IF NOT EXISTS desafio_progresso (
  workspace_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tarefa_id    UUID NOT NULL REFERENCES desafio_tarefas(id) ON DELETE CASCADE,
  desafio_id   UUID NOT NULL REFERENCES desafios(id) ON DELETE CASCADE,
  feito_em     TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (workspace_id, tarefa_id)
);

CREATE INDEX IF NOT EXISTS desafio_progresso_desafio_idx ON desafio_progresso (desafio_id);

COMMENT ON TABLE desafios IS
  'Desafios do Mão na Massa, criados pela equipe no painel admin. Aluna só lê os publicados.';
COMMENT ON TABLE desafio_progresso IS
  'Tarefas de desafio que cada aluna marcou como feitas. Cada uma vê e mexe só no dela.';

ALTER TABLE desafios ENABLE ROW LEVEL SECURITY;
ALTER TABLE desafio_tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE desafio_progresso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alunas leem desafios publicados" ON desafios
  FOR SELECT TO authenticated USING (publicado);

CREATE POLICY "Alunas leem tarefas de desafios publicados" ON desafio_tarefas
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM desafios d WHERE d.id = desafio_tarefas.desafio_id AND d.publicado)
  );

CREATE POLICY "Aluna lê o próprio progresso" ON desafio_progresso
  FOR SELECT TO authenticated USING (workspace_id = auth.uid());

-- Marcar só vale em tarefa de desafio publicado, e a tarefa tem que ser
-- mesmo daquele desafio: sem isso, dava pra gravar progresso em rascunho.
CREATE POLICY "Aluna marca o próprio progresso" ON desafio_progresso
  FOR INSERT TO authenticated WITH CHECK (
    workspace_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM desafio_tarefas t
      JOIN desafios d ON d.id = t.desafio_id
      WHERE t.id = desafio_progresso.tarefa_id
        AND t.desafio_id = desafio_progresso.desafio_id
        AND d.publicado
    )
  );

CREATE POLICY "Aluna desmarca o próprio progresso" ON desafio_progresso
  FOR DELETE TO authenticated USING (workspace_id = auth.uid());
