-- 004_lgpd_consent.sql
-- Prioridade 1 do documento "Fluxo de Aviso LGPD — Partiu PRO v5":
-- registro de aceite dos termos, consentimento de divulgação e log de
-- acesso administrativo aos dados de uma usuária. Também troca as FKs
-- que apontam pra users(id) — incluindo o próprio users.id -> auth.users(id)
-- — para ON DELETE CASCADE, pré-requisito pra "encerrar conta" (Privacidade)
-- funcionar com uma única chamada a supabaseAdmin.auth.admin.deleteUser().

-- ============================================
-- CASCATA DE EXCLUSÃO DE CONTA
-- ============================================
-- Os nomes de constraint abaixo são os gerados automaticamente pelo Postgres
-- pra REFERENCES inline (padrão "<tabela>_<coluna>_fkey"), como definidas em
-- 001_init_corrigido.sql e 002_atendimentos_metas.sql.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_id_fkey;
ALTER TABLE users ADD CONSTRAINT users_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE product_categories DROP CONSTRAINT IF EXISTS product_categories_workspace_id_fkey;
ALTER TABLE product_categories ADD CONSTRAINT product_categories_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_workspace_id_fkey;
ALTER TABLE products ADD CONSTRAINT products_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_workspace_id_fkey;
ALTER TABLE customers ADD CONSTRAINT customers_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE vendas_diarias DROP CONSTRAINT IF EXISTS vendas_diarias_workspace_id_fkey;
ALTER TABLE vendas_diarias ADD CONSTRAINT vendas_diarias_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_workspace_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE delivery_settings DROP CONSTRAINT IF EXISTS delivery_settings_workspace_id_fkey;
ALTER TABLE delivery_settings ADD CONSTRAINT delivery_settings_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE delivery_routes DROP CONSTRAINT IF EXISTS delivery_routes_workspace_id_fkey;
ALTER TABLE delivery_routes ADD CONSTRAINT delivery_routes_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_workspace_id_fkey;
ALTER TABLE chat_sessions ADD CONSTRAINT chat_sessions_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE assistant_settings DROP CONSTRAINT IF EXISTS assistant_settings_workspace_id_fkey;
ALTER TABLE assistant_settings ADD CONSTRAINT assistant_settings_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE atendimentos_diarios DROP CONSTRAINT IF EXISTS atendimentos_diarios_workspace_id_fkey;
ALTER TABLE atendimentos_diarios ADD CONSTRAINT atendimentos_diarios_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE metas DROP CONSTRAINT IF EXISTS metas_workspace_id_fkey;
ALTER TABLE metas ADD CONSTRAINT metas_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES users(id) ON DELETE CASCADE;

-- ============================================
-- ACEITE DE TERMOS
-- ============================================
-- Uma linha por aceite. Guarda o texto integral aceito (não só a versão),
-- porque o texto pode ser reescrito sem mudar a versão em rascunho — aqui
-- fica o que a usuária realmente leu e aceitou.

CREATE TABLE terms_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL,
  terms_text TEXT NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  ip TEXT
);

CREATE INDEX idx_terms_acceptances_user ON terms_acceptances(user_id, accepted_at DESC);

ALTER TABLE terms_acceptances ENABLE ROW LEVEL SECURITY;

-- Insert só via service role (signup ocorre antes de existir sessão, igual
-- ao insert em users — ver app/api/auth/route.ts).
CREATE POLICY "Users can read their terms acceptances" ON terms_acceptances
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- CONSENTIMENTO DE DIVULGAÇÃO (MARKETING)
-- ============================================
-- Uma linha por usuária (não histórico de eventos) — o estado atual é o que
-- importa pro checklist de divulgação; granted_at/revoked_at guardam a última
-- mudança.

CREATE TABLE marketing_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT FALSE,
  granted_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE marketing_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their marketing consent" ON marketing_consents
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their marketing consent" ON marketing_consents
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- LOG DE ACESSO ADMINISTRATIVO
-- ============================================
-- Toda vez que a mentora abre o detalhe de uma aluna no /admin, 1 linha é
-- gravada aqui (via supabaseAdmin, porque o admin não é o dono da linha —
-- não dá pra usar uma policy de sessão pro insert). A aluna pode ver quem
-- acessou os dados dela na aba Privacidade.

CREATE TABLE admin_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_admin_access_log_workspace ON admin_access_log(workspace_id, accessed_at DESC);

ALTER TABLE admin_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read access log about themselves" ON admin_access_log
  FOR SELECT USING (auth.uid() = workspace_id);
