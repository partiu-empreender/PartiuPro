-- ============================================
-- 024: REGISTRO DAS POLICIES CRIADAS PELO PAINEL
-- ============================================
--
-- Ao montar o banco de teste (out/2026) a partir das migrations 001–023, a
-- comparação com produção mostrou 28 policies que existem lá mas não estão em
-- nenhum arquivo: foram criadas direto no painel do Supabase, em algum
-- momento antes desta pasta virar a fonte da verdade. Sem elas, um banco
-- remontado do zero ficaria diferente do real.
--
-- O texto de cada uma foi copiado de pg_policies em produção.
--
-- POR QUE "SÓ SE NÃO EXISTIR"
--
-- Em produção todas já existem, então rodar este arquivo lá não muda nada.
-- Num banco novo, ele cria as que faltam. Nada é apagado: CREATE POLICY não
-- tem IF NOT EXISTS, por isso a checagem em pg_policies.

DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT * FROM (VALUES
      ('assistant_settings', 'Users can create their assistant settings', 'FOR INSERT TO public WITH CHECK ((auth.uid() = workspace_id))'),
      ('assistant_settings', 'Users can read their assistant settings', 'FOR SELECT TO public USING ((auth.uid() = workspace_id))'),
      ('assistant_settings', 'Users can update their assistant settings', 'FOR UPDATE TO public USING ((auth.uid() = workspace_id))'),
      ('customer_interactions', 'Users can create customer interactions', 'FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1 FROM customers WHERE ((customers.id = customer_interactions.customer_id) AND (customers.workspace_id = auth.uid())))))'),
      ('customer_interactions', 'Users can read their customer interactions', 'FOR SELECT TO public USING ((EXISTS ( SELECT 1 FROM customers WHERE ((customers.id = customer_interactions.customer_id) AND (customers.workspace_id = auth.uid())))))'),
      ('delivery_routes', 'Users can create delivery routes', 'FOR INSERT TO public WITH CHECK ((auth.uid() = workspace_id))'),
      ('delivery_routes', 'Users can delete their delivery routes', 'FOR DELETE TO public USING ((auth.uid() = workspace_id))'),
      ('delivery_routes', 'Users can read their delivery routes', 'FOR SELECT TO public USING ((auth.uid() = workspace_id))'),
      ('delivery_routes', 'Users can update their delivery routes', 'FOR UPDATE TO public USING ((auth.uid() = workspace_id))'),
      ('delivery_settings', 'Users can create their delivery settings', 'FOR INSERT TO public WITH CHECK ((auth.uid() = workspace_id))'),
      ('delivery_settings', 'Users can read their delivery settings', 'FOR SELECT TO public USING ((auth.uid() = workspace_id))'),
      ('delivery_settings', 'Users can update their delivery settings', 'FOR UPDATE TO public USING ((auth.uid() = workspace_id))'),
      ('order_additional_items', 'Users can create order additional items', 'FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1 FROM (order_items JOIN orders ON ((orders.id = order_items.order_id))) WHERE ((order_items.id = order_additional_items.order_item_id) AND (orders.workspace_id = auth.uid())))))'),
      ('order_additional_items', 'Users can delete their order additional items', 'FOR DELETE TO public USING ((EXISTS ( SELECT 1 FROM (order_items JOIN orders ON ((orders.id = order_items.order_id))) WHERE ((order_items.id = order_additional_items.order_item_id) AND (orders.workspace_id = auth.uid())))))'),
      ('order_additional_items', 'Users can read their order additional items', 'FOR SELECT TO public USING ((EXISTS ( SELECT 1 FROM (order_items JOIN orders ON ((orders.id = order_items.order_id))) WHERE ((order_items.id = order_additional_items.order_item_id) AND (orders.workspace_id = auth.uid())))))'),
      ('order_items', 'Users can create order items', 'FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1 FROM orders WHERE ((orders.id = order_items.order_id) AND (orders.workspace_id = auth.uid())))))'),
      ('order_items', 'Users can delete their order items', 'FOR DELETE TO public USING ((EXISTS ( SELECT 1 FROM orders WHERE ((orders.id = order_items.order_id) AND (orders.workspace_id = auth.uid())))))'),
      ('order_items', 'Users can read their order items', 'FOR SELECT TO public USING ((EXISTS ( SELECT 1 FROM orders WHERE ((orders.id = order_items.order_id) AND (orders.workspace_id = auth.uid())))))'),
      ('order_items', 'Users can update their order items', 'FOR UPDATE TO public USING ((EXISTS ( SELECT 1 FROM orders WHERE ((orders.id = order_items.order_id) AND (orders.workspace_id = auth.uid())))))'),
      ('orders', 'Users can delete their orders', 'FOR DELETE TO public USING ((auth.uid() = workspace_id))'),
      ('product_additionals', 'Users can create product additionals', 'FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1 FROM products WHERE ((products.id = product_additionals.product_id) AND (products.workspace_id = auth.uid())))))'),
      ('product_additionals', 'Users can delete their product additionals', 'FOR DELETE TO public USING ((EXISTS ( SELECT 1 FROM products WHERE ((products.id = product_additionals.product_id) AND (products.workspace_id = auth.uid())))))'),
      ('product_additionals', 'Users can read their product additionals', 'FOR SELECT TO public USING ((EXISTS ( SELECT 1 FROM products WHERE ((products.id = product_additionals.product_id) AND (products.workspace_id = auth.uid())))))'),
      ('product_additionals', 'Users can update their product additionals', 'FOR UPDATE TO public USING ((EXISTS ( SELECT 1 FROM products WHERE ((products.id = product_additionals.product_id) AND (products.workspace_id = auth.uid())))))'),
      ('product_categories', 'Users can create product categories', 'FOR INSERT TO public WITH CHECK ((auth.uid() = workspace_id))'),
      ('product_categories', 'Users can delete their product categories', 'FOR DELETE TO public USING ((auth.uid() = workspace_id))'),
      ('product_categories', 'Users can read their product categories', 'FOR SELECT TO public USING ((auth.uid() = workspace_id))'),
      ('product_categories', 'Users can update their product categories', 'FOR UPDATE TO public USING ((auth.uid() = workspace_id))')
    ) AS t(tabela, nome, regra)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = p.tabela AND policyname = p.nome
    ) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I %s', p.nome, p.tabela, p.regra);
    END IF;
  END LOOP;
END;
$$;
