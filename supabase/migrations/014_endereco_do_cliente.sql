-- ============================================
-- 014: ENDEREÇO DA CLIENTE
-- ============================================
--
-- Pedido da Tania (10/09/2026): endereço, complemento, bairro e cidade no
-- cadastro da cliente.
--
-- POR QUE NA CLIENTE, E NÃO SÓ NA VENDA
--
-- `vendas_diarias` já tem um `bairro`, mas ele responde outra pergunta: para
-- onde foi AQUELA entrega. O endereço da cliente é de quem ela é — serve para
-- a próxima venda, sem redigitar, e para a aluna saber onde a freguesia mora.
-- São dados diferentes com ciclos de vida diferentes: a entrega de dezembro
-- pode ir para o trabalho e a de janeiro para casa, sem que a cliente tenha
-- mudado de endereço.
--
-- Tudo NULL: quem já cadastrou cliente não é obrigada a voltar e preencher.
-- Vender para alguém sem saber a rua é o caso comum, não a exceção.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS endereco     TEXT,
  ADD COLUMN IF NOT EXISTS complemento  TEXT,
  ADD COLUMN IF NOT EXISTS bairro       TEXT,
  ADD COLUMN IF NOT EXISTS cidade       TEXT;

COMMENT ON COLUMN customers.endereco IS
  'Rua e número. Endereço de cadastro da cliente, não o de uma entrega específica — esse fica em vendas_diarias.';

COMMENT ON COLUMN customers.complemento IS
  'Apartamento, bloco, referência.';

COMMENT ON COLUMN customers.bairro IS
  'Bairro da cliente. Não confundir com vendas_diarias.bairro, que é o bairro daquela entrega.';

COMMENT ON COLUMN customers.cidade IS
  'Cidade da cliente.';

-- Sem índice: estes campos são para LER na ficha da cliente, não para filtrar
-- ou agrupar. Índice aqui só custaria escrita. Se algum dia existir "clientes
-- por bairro", o índice entra junto com a tela que o usa.
