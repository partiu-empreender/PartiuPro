-- ============================================
-- 021: venda_itens ganha DELETE e UPDATE
-- ============================================
--
-- BUG DE PRODUÇÃO, relatado pela aluna em 21/09/2026: "vendi 2 Declaração em
-- abril e aparece 3 no relatório". Eram de fato 3 linhas no banco para 2
-- vendas — uma venda tinha os itens DUPLICADOS.
--
-- A CAUSA
--
-- `venda_itens` nasceu na migration 001 com RLS ligada e apenas DUAS políticas:
-- SELECT e INSERT. Não havia DELETE nem UPDATE.
--
-- Enquanto a venda era só criada e excluída, isso não aparecia: excluir a
-- venda leva os itens junto pelo ON DELETE CASCADE, que roda no banco e não
-- passa por RLS. O buraco só se abriu quando a edição de venda foi criada
-- (etapa 1, 10/09/2026): ela troca os itens com um DELETE seguido de INSERT.
--
-- Sem política de DELETE, o Postgres não recusa com erro — ele simplesmente
-- não apaga nenhuma linha e responde sucesso. O INSERT seguinte então SOMA os
-- itens novos aos antigos. Toda edição que mexesse nos itens dobrava a venda.
--
-- Isso também explica o relato "aparece 2 e depois 1": ao reinserir, os itens
-- novos vêm sem `produto_id` quando foram digitados à mão, e o ranking agrupa
-- por produto do catálogo. O mesmo item caía em dois baldes.
--
-- Um sucesso silencioso é a pior forma de falha: nada nos logs, nada na tela,
-- e o número errado com ar de certeza. O código também passou a conferir o
-- resultado do delete (app/api/vendas/route.ts) — a política sozinha
-- resolveria hoje, mas as duas juntas impedem que volte calado.

CREATE POLICY "Users can delete their venda_itens" ON venda_itens
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM vendas_diarias
      WHERE vendas_diarias.id = venda_itens.venda_id
        AND vendas_diarias.workspace_id = auth.uid()
    )
  );

-- UPDATE entra junto porque a lacuna é a mesma e a próxima tela que precisar
-- ajustar um item sem recriá-lo encontraria o mesmo sucesso silencioso.
CREATE POLICY "Users can update their venda_itens" ON venda_itens
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM vendas_diarias
      WHERE vendas_diarias.id = venda_itens.venda_id
        AND vendas_diarias.workspace_id = auth.uid()
    )
  );
