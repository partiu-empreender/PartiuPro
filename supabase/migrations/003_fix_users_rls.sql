-- 003_fix_users_rls.sql
-- A tabela `users` tinha RLS ativa mas só com policy de SELECT — todo
-- signup (insert do perfil em app/api/auth/route.ts) e toda edição de
-- perfil (app/api/perfil/route.ts) eram bloqueados silenciosamente.

CREATE POLICY "Users can create their own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
