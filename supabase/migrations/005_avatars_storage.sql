-- 005_avatars_storage.sql
-- Bucket de fotos de perfil. A coluna users.avatar_url já existe desde
-- 001_init_corrigido.sql — aqui entra só o lugar de guardar o arquivo.
--
-- Escrita: feita exclusivamente pelo servidor (app/api/perfil/avatar),
-- com o cliente service-role, que monta o caminho a partir do auth.uid()
-- da sessão — nunca a partir de dado vindo do navegador. Por isso não há
-- policy de INSERT/UPDATE/DELETE: ninguém escreve aqui com a chave anon.
--
-- Leitura: pública, porque a foto é exibida na navbar via <img src>.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  TRUE,
  2097152, -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Avatars sao publicos para leitura" ON storage.objects;
CREATE POLICY "Avatars sao publicos para leitura" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
