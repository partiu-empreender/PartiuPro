-- 008_venda_sobrevive_ao_cliente.sql
-- ============================================
-- Excluir uma cliente não pode apagar nem travar o faturamento.
--
-- `vendas_diarias.customer_id` referenciava `customers(id)` com NO ACTION.
-- Na prática isso significava que excluir uma cliente que já tinha comprado
-- falhava com erro de chave estrangeira — a aluna clicava em excluir e recebia
-- um erro incompreensível, sem saída a não ser conviver com o cadastro errado.
--
-- CASCADE seria pior ainda: apagaria as vendas junto, e o faturamento do mês
-- mudaria retroativamente por causa de uma limpeza de cadastro.
--
-- SET NULL é a regra certa: a venda aconteceu e continua contando no
-- faturamento; ela só deixa de estar ligada a um contato que não existe mais.
-- O nome digitado na hora permanece em vendas_diarias.cliente_nome, então o
-- histórico continua legível.
-- ============================================

ALTER TABLE vendas_diarias
  DROP CONSTRAINT IF EXISTS vendas_diarias_customer_id_fkey;

ALTER TABLE vendas_diarias
  ADD CONSTRAINT vendas_diarias_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

COMMENT ON COLUMN vendas_diarias.customer_id IS
  'Cliente do CRM, quando vinculada. Vira NULL se a cliente for excluída — a venda permanece no faturamento, com o nome preservado em cliente_nome.';
