-- 011_fechamento_mensal.sql
-- Fechamento de um mês JÁ ENCERRADO, preenchido à mão.
--
-- O sistema não pode começar a existir no dia em que a aluna instalou. Ela
-- chega com uma planilha (ou um caderno) de meses ou anos de faturamento, e
-- hoje a única forma de colocar isso aqui dentro é digitar venda por venda —
-- com cliente, item e preço, dados que ela muitas vezes não tem mais. O que
-- ela tem é o total: "julho fechou em 38.400, foram 62 vendas, atendi umas
-- 180 pessoas".
--
-- Esta tabela é o lugar desse total. Uma linha por mês/ano, com os mesmos
-- números que o dashboard mostra — e só os que ela DIGITA. PA não está aqui
-- de propósito, e ticket médio e conversão só como escape (ver abaixo): são
-- divisões dos outros campos, feitas em lib/fechamento.ts, e guardar o
-- resultado junto com os operandos é convite pros três discordarem entre si
-- na primeira edição.
--
-- Por que não estender `metas`: meta é o que ela QUER faturar, fechamento é
-- o que ela FATUROU. Já convivem hoje na tela de Metas como duas colunas
-- diferentes, e juntar as duas numa linha só faria "meta 0" e "não definida"
-- virarem a mesma coisa — o bug que o comentário de app/dashboard/metas
-- descreve por extenso.
--
-- ============================================
-- A REGRA QUE SUSTENTA O RESTO: só o passado
-- ============================================
-- O mês corrente NUNCA aceita fechamento manual. Ele é calculado ao vivo das
-- vendas, como sempre foi, e é a tela que a aluna usa todo dia — deixar um
-- número digitado competir com o cálculo em tempo real ali significaria que o
-- painel para de responder às vendas que ela acabou de registrar.
--
-- No passado a disputa é outra e a decisão é oposta: quando um mês encerrado
-- tem fechamento manual E vendas lançadas, o MANUAL vence. Ele é o número da
-- planilha, o mês inteiro; as vendas lançadas costumam ser as três que ela
-- digitou testando o sistema. Deixar essas três sobrescreverem o total do mês
-- mostraria R$ 2.100 onde houve R$ 38.400.
--
-- O que impede isso de esconder dado real: a API devolve as duas somas
-- (`faturamento` manual e o calculado das vendas) e a tela avisa quando elas
-- divergem, com a opção de descartar o fechamento e voltar a usar as vendas.
-- Vencer em silêncio é que seria o problema; vencer avisando é a escolha dela.

CREATE TABLE IF NOT EXISTS fechamentos_mensais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER NOT NULL CHECK (ano BETWEEN 2000 AND 2100),

  -- Os campos que ela digita. Todos opcionais: quem só sabe o faturamento
  -- preenche o faturamento e pronto. NULL aqui quer dizer "não sei", e é
  -- diferente de 0 ("não houve") — a tela mostra travessão pro primeiro e o
  -- número pro segundo, do mesmo jeito que a de Metas já faz com meta 0.
  faturamento NUMERIC(12, 2) CHECK (faturamento IS NULL OR faturamento >= 0),
  vendas INTEGER CHECK (vendas IS NULL OR vendas >= 0),
  produtos_vendidos INTEGER CHECK (produtos_vendidos IS NULL OR produtos_vendidos >= 0),
  atendimentos INTEGER CHECK (atendimentos IS NULL OR atendimentos >= 0),

  -- Escapes pros dois derivados. Existem porque a conta nem sempre fecha com o
  -- que ela lembra: quem anotou "ticket médio 620" mas não sabe quantas vendas
  -- foram não consegue chegar lá por divisão. Quando preenchidos, vencem o
  -- cálculo; quando NULL (o caso normal), lib/fechamento.ts calcula.
  ticket_medio NUMERIC(12, 2) CHECK (ticket_medio IS NULL OR ticket_medio >= 0),
  conversao NUMERIC(5, 2) CHECK (conversao IS NULL OR (conversao >= 0 AND conversao <= 100)),

  observacao TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  -- Mesma chave de `metas`, e de propósito: é o que deixa as duas tabelas
  -- serem lidas lado a lado por mês/ano sem nenhuma tradução no meio.
  UNIQUE (workspace_id, mes, ano)
);

COMMENT ON TABLE fechamentos_mensais IS
  'Números de um mês já encerrado, digitados à mão pela aluna. Nunca do mês corrente — esse é sempre calculado das vendas.';
COMMENT ON COLUMN fechamentos_mensais.ticket_medio IS
  'Só quando ela sabe o ticket mas não as vendas. NULL = calcular faturamento/vendas.';
COMMENT ON COLUMN fechamentos_mensais.conversao IS
  'Só quando ela sabe a conversão mas não os atendimentos. NULL = calcular vendas/atendimentos.';

CREATE INDEX IF NOT EXISTS idx_fechamentos_workspace_ano
  ON fechamentos_mensais(workspace_id, ano DESC, mes DESC);

-- ============================================
-- updated_at
-- ============================================
-- Editar o fechamento é a operação normal aqui (ela digita o que lembra, e
-- corrige quando acha a planilha), então saber quando foi a última mexida é o
-- que permite à tela dizer "preenchido à mão em 12/08".
-- `SET search_path = ''` porque sem isso a função resolve nomes pelo
-- search_path de quem dispara o trigger, e o linter de segurança do Supabase
-- aponta (0011_function_search_path_mutable): quem conseguisse criar um schema
-- à frente na busca trocaria por baixo o que a função enxerga. Ela só usa
-- NOW() e TIMEZONE(), mas fixar custa uma linha.
CREATE OR REPLACE FUNCTION tocar_updated_at_fechamentos()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fechamentos_updated_at ON fechamentos_mensais;
CREATE TRIGGER trg_fechamentos_updated_at
  BEFORE UPDATE ON fechamentos_mensais
  FOR EACH ROW
  EXECUTE FUNCTION tocar_updated_at_fechamentos();

-- ============================================
-- RLS
-- ============================================
-- Mesmo desenho de 002 (metas) e 010: workspace_id comparado direto com
-- auth.uid(), uma policy por operação.
ALTER TABLE fechamentos_mensais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their fechamentos" ON fechamentos_mensais;
CREATE POLICY "Users can read their fechamentos" ON fechamentos_mensais
  FOR SELECT USING (auth.uid() = workspace_id);

DROP POLICY IF EXISTS "Users can create fechamentos" ON fechamentos_mensais;
CREATE POLICY "Users can create fechamentos" ON fechamentos_mensais
  FOR INSERT WITH CHECK (auth.uid() = workspace_id);

DROP POLICY IF EXISTS "Users can update their fechamentos" ON fechamentos_mensais;
CREATE POLICY "Users can update their fechamentos" ON fechamentos_mensais
  FOR UPDATE USING (auth.uid() = workspace_id);

DROP POLICY IF EXISTS "Users can delete their fechamentos" ON fechamentos_mensais;
CREATE POLICY "Users can delete their fechamentos" ON fechamentos_mensais
  FOR DELETE USING (auth.uid() = workspace_id);
