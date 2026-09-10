-- ============================================
-- 016: DDI DO TELEFONE
-- ============================================
--
-- Pedido da Tania (10/09/2026): escolher o país do telefone, Brasil padrão.
--
-- POR QUE UMA COLUNA SEPARADA, E NÃO O DDI DENTRO DO NÚMERO
--
-- O sistema assume Brasil em dois pontos que se contradizem:
-- `normalizarTelefone` REMOVE o 55 ao gravar, e `linkWhatsApp` CRAVA o 55 ao
-- montar o link. Enquanto todo mundo é brasileiro isso se anula e funciona.
-- No primeiro cadastro estrangeiro, o DDI some na gravação e um 55 errado
-- entra na conversa.
--
-- Embutir o DDI no número resolveria o link e quebraria coisa pior: `phone` é
-- a chave de UNIQUE(workspace_id, phone) e é por ela que a venda encontra a
-- cliente e o CSV decide entre criar e atualizar. Mudar o formato do número
-- faria o mesmo telefone virar duas clientes — exatamente o problema que o
-- CRM existe para resolver.
--
-- Com a coluna separada, `phone` continua sendo só dígitos nacionais: nenhum
-- cadastro existente precisa ser tocado, e o default '55' faz cada um deles
-- continuar se comportando exatamente como antes.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS ddi TEXT NOT NULL DEFAULT '55';

COMMENT ON COLUMN customers.ddi IS
  'Código do país do telefone, só dígitos, sem +. Fica FORA de phone de propósito: phone é a chave de deduplicação e não pode mudar de formato.';

-- Sem índice: o DDI nunca é critério de busca — quem procura, procura pelo
-- número. Ele só acompanha o telefone na hora de montar o link.
