-- ============================================
-- 023: SÓ O SERVIDOR DECIDE QUEM É ADMIN
-- ============================================
--
-- Auditoria de segurança (out/2026): a policy "Users can update their own
-- profile" deixa cada aluna editar a PRÓPRIA linha de `users` — e isso
-- incluía a coluna `is_admin`. Com a chave anon (que vai no navegador por
-- design) e a sessão dela, um PATCH direto no PostgREST bastava para virar
-- admin, e as rotas /api/admin/* passavam a devolver os dados de todas as
-- alunas. Reproduzido numa transação revertida antes desta correção.
--
-- POR QUE GATILHO, E NÃO REVOGAR O GRANT DE UPDATE
--
-- Revogar a coluna exigiria regravar os grants da tabela inteira e acertar
-- cada coluna que o app edita (nome, foto). O gatilho olha só para o que
-- importa: quem chama pelo app (papéis `authenticated` e `anon`) não muda
-- `is_admin`. O servidor (service_role) e o painel do Supabase (postgres)
-- continuam podendo — é por lá que se nomeia uma admin.
--
-- Nenhuma linha existente é alterada. Para desfazer:
--   DROP TRIGGER IF EXISTS proteger_is_admin ON public.users;
--   DROP FUNCTION IF EXISTS public.proteger_is_admin();

CREATE OR REPLACE FUNCTION public.proteger_is_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      -- Perfil criado pelo próprio app nunca nasce admin.
      NEW.is_admin := false;
    ELSIF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
      RAISE EXCEPTION 'is_admin só pode ser alterado pelo servidor'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proteger_is_admin ON public.users;
CREATE TRIGGER proteger_is_admin
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.proteger_is_admin();
