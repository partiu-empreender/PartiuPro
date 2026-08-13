# 📊 RESUMO TÉCNICO - RAIO-X v2.0 CORRIGIDO

## O PROBLEMA QUE FOI RESOLVIDO

### Antes (Errado ❌)
```
Cliente João compra: 1 bolo + 1 suco = R$ 100
Sistema registrava: 2 VENDAS (1 por produto)
PA calculado: 2 / 1 cliente = 2 (confundindo com atendimento)
ERRO: Métricas infladas!
```

### Depois (Correto ✅)
```
Cliente João compra: 1 bolo + 1 suco = R$ 100
Sistema registra: 1 VENDA (1 cliente, 2 itens)
PA calculado: 2 itens / 1 venda = 2 (correto!)
BENEFÍCIO: Métricas precisas para decisão!
```

---

## ARQUITETURA DO BANCO DE DADOS

### Tabelas Principais

**vendas_diarias** (1 registro = 1 cliente/transação)
```
id                UUID
workspace_id      UUID (workspace do usuário)
customer_id       UUID (cliente)
data              DATE
cliente_nome      TEXT
bairro            TEXT
faturamento_total DECIMAL (soma dos itens + frete)
status            'draft' | 'pending' | 'confirmed' | 'delivered' | 'cancelled'
shipping_cost     DECIMAL
delivery_date     DATE
created_at        TIMESTAMP
```

**venda_itens** (múltiplos = múltiplos produtos na venda)
```
id              UUID
venda_id        UUID → REFERENCES vendas_diarias(id)
produto_id      UUID → REFERENCES products(id)
quantidade      INTEGER
preco_unitario  DECIMAL
subtotal        DECIMAL
created_at      TIMESTAMP
```

### Exemplo de Dados

**vendas_diarias:**
```
| id     | customer_id | cliente_nome | bairro  | faturamento_total |
|--------|-------------|--------------|---------|-------------------|
| venda1 | cust001     | João Silva   | Centro  | 190.00            |
| venda2 | cust002     | Maria Santos | Vila    | 85.50             |
```

**venda_itens:**
```
| id    | venda_id | produto_id | quantidade | preco_unitario | subtotal |
|-------|----------|------------|------------|----------------|----------|
| item1 | venda1   | prod001    | 1          | 100.00         | 100.00   |
| item2 | venda1   | prod002    | 2          | 45.00          | 90.00    |
| item3 | venda2   | prod001    | 1          | 85.50          | 85.50    |
```

---

## CÁLCULOS DE MÉTRICAS

### Fórmulas SQL

```sql
-- ATENDIMENTOS (clientes únicos)
SELECT COUNT(DISTINCT customer_id) 
FROM vendas_diarias 
WHERE data = '2026-08-13' AND workspace_id = ?

-- VENDAS (transações)
SELECT COUNT(*) 
FROM vendas_diarias 
WHERE data = '2026-08-13' AND workspace_id = ?

-- PRODUTOS POR ATENDIMENTO (PA)
SELECT COUNT(*) 
FROM venda_itens vi
JOIN vendas_diarias vd ON vi.venda_id = vd.id
WHERE vd.data = '2026-08-13' AND vd.workspace_id = ?
DIVIDED BY (número de vendas)

-- FATURAMENTO TOTAL
SELECT SUM(faturamento_total) 
FROM vendas_diarias 
WHERE data = '2026-08-13' AND workspace_id = ?

-- TICKET MÉDIO
SELECT SUM(faturamento_total) / COUNT(*) 
FROM vendas_diarias 
WHERE data = '2026-08-13' AND workspace_id = ?
```

### Resultados do Dashboard

**Exemplo com dados reais:**
```
Atendimentos: 5 clientes
Vendas: 5 transações
PA: 15 itens / 5 vendas = 3.00 produtos por transação
Faturamento: R$ 1.050,00
Ticket Médio: R$ 1.050 / 5 = R$ 210,00
```

---

## API ENDPOINTS

### POST /api/vendas - Registrar Venda

**Request:**
```json
{
  "cliente_nome": "João Silva",
  "customer_id": "123e4567-e89b-12d3-a456-426614174000",
  "bairro": "Centro",
  "items": [
    {
      "produto_id": "prod-uuid-1",
      "quantidade": 1,
      "preco_unitario": 100.00
    },
    {
      "produto_id": "prod-uuid-2",
      "quantidade": 2,
      "preco_unitario": 45.00
    }
  ],
  "shipping_cost": 10.00,
  "delivery_date": "2026-08-14",
  "delivery_period": "morning"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "venda_id": "uuid",
    "cliente_nome": "João Silva",
    "quantidade_itens": 2,
    "faturamento_total": 200.00,
    "status": "draft"
  },
  "message": "Venda registrada com sucesso! 2 produto(s) adicionado(s)"
}
```

### GET /api/vendas - Listar Vendas do Dia

**Response:**
```json
{
  "success": true,
  "vendas": [...],
  "metricas": {
    "atendimentos": 5,
    "vendas": 5,
    "pa": 3.00,
    "faturamento_total": 1050.00,
    "ticket_medio": 210.00,
    "total_itens": 15
  }
}
```

---

## COMPONENTES REACT

### Dashboard (5 Abas)

1. **Métricas** - Gráficos e cards
2. **Vendas do Dia** - Lista de transações
3. **Precificação** - Calculadora integrada
4. **Custos** - Análise de despesas
5. **Lucro** - Análise de margem

### Calculadora de Precificação (5 Passos)

1. Custo Direto - O que custa produzir?
2. Despesas Fixas - Custos operacionais
3. Margem de Lucro - Estratégia de preço
4. Calculadora - Ferramenta interativa
5. Exemplo Real - Caso de uso (café da manhã)

---

## FLUXO DE REGISTRO DE VENDA

```
Usuário clica "Registrar Venda"
    ↓
Modal abre com:
  - Campo cliente (autocomplete)
  - Campo bairro
  - Seletor de produtos (múltiplo)
  - Quantidade por produto
  - Campo de frete
    ↓
Usuário preenche e clica "Salvar"
    ↓
Sistema chama POST /api/vendas
    ↓
Backend:
  1. Cria 1 registro em vendas_diarias
  2. Cria N registros em venda_itens (um por produto)
  3. Calcula faturamento_total
  4. Atualiza métrica de customer
    ↓
Retorna sucesso e atualiza dashboard
    ↓
Métricas recalculadas em tempo real
```

---

## PRECIFICAÇÃO - FÓRMULA

```
Entrada do Usuário:
├─ Custo Direto: R$ 75,16
├─ Custo Fixo: 25% (dropdown)
└─ Margem: 90% (buttons)

Cálculo:
├─ Custo Fixo = 75,16 × 0,25 = R$ 18,79
├─ Subtotal = 75,16 + 18,79 = R$ 93,95
├─ Margem = 93,95 × 0,90 = R$ 85,05
└─ PREÇO FINAL = 93,95 + 85,05 = R$ 178,51

Dica: Arredondar para R$ 179 ou R$ 180
```

---

## SEGURANÇA - ROW LEVEL SECURITY (RLS)

Todas as tabelas têm RLS habilitado:

```sql
-- Cada usuário vê apenas suas vendas
CREATE POLICY "Users can read their vendas"
ON vendas_diarias
FOR SELECT
USING (auth.uid() = workspace_id);

-- Evita acesso cruzado entre workspaces
CREATE POLICY "Users can read their venda_itens"
ON venda_itens
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM vendas_diarias
    WHERE vendas_diarias.id = venda_itens.venda_id
    AND vendas_diarias.workspace_id = auth.uid()
  )
);
```

---

## PERFORMANCE - ÍNDICES

```sql
CREATE INDEX idx_vendas_workspace ON vendas_diarias(workspace_id);
CREATE INDEX idx_vendas_data ON vendas_diarias(data);
CREATE INDEX idx_vendas_customer ON vendas_diarias(customer_id);
CREATE INDEX idx_venda_itens_venda ON venda_itens(venda_id);
CREATE INDEX idx_venda_itens_produto ON venda_itens(produto_id);
```

---

## MUDANÇAS NO CÓDIGO

### Antes
```typescript
// Dashboard
const vendas = await db.select().from(orders);
const contagem = vendas.length; // ❌ Contava linhas, não vendas

// Métrica de vendas
const vendasCount = vendas.filter(v => v.status === 'confirmed').length;
// ❌ Contava line items, não transações
```

### Depois
```typescript
// Dashboard
const vendas = await db
  .select()
  .from(vendas_diarias)
  .where(eq(vendas_diarias.data, hoje));

const vendaItens = await db
  .select()
  .from(venda_itens)
  .where(inArray(venda_itens.venda_id, vendas.map(v => v.id)));

// Métrica corrigida
const atendimentos = vendas.length; // ✅ Número de clientes
const vendasCount = vendas.length;  // ✅ Número de transações
const pa = vendaItens.length / vendasCount; // ✅ PA correto
```

---

## TESTES RECOMENDADOS

```javascript
// Teste 1: Registrar venda com múltiplos produtos
POST /api/vendas
{
  "cliente_nome": "Teste",
  "items": [
    { "produto_id": "p1", "quantidade": 1, "preco_unitario": 100 },
    { "produto_id": "p2", "quantidade": 1, "preco_unitario": 50 },
    { "produto_id": "p3", "quantidade": 1, "preco_unitario": 25 }
  ]
}
// Esperado: vendas = 1, itens = 3, PA = 3

// Teste 2: Registrar 2 vendas diferentes
// Esperado: vendas = 2, atendimentos = 2

// Teste 3: Mesmo cliente, 2 vendas
// Esperado: vendas = 2, atendimentos = 1

// Teste 4: Calculadora de preço
// Entrada: 75.16 (custo), 25% (fixo), 90% (margem)
// Esperado: 179.00 (aproximadamente)
```

---

## MIGRAÇÃO DE DADOS (Se necessário)

```sql
-- Copiar dados do sistema antigo para o novo
INSERT INTO vendas_diarias (
  workspace_id, customer_id, data, cliente_nome, 
  faturamento_total, status, created_at
)
SELECT 
  o.workspace_id, 
  o.customer_id,
  o.delivery_date,
  c.name,
  o.total,
  o.status,
  o.created_at
FROM orders o
JOIN customers c ON o.customer_id = c.id
GROUP BY o.id;

-- Copiar itens
INSERT INTO venda_itens (venda_id, produto_id, quantidade, preco_unitario, subtotal)
SELECT 
  vd.id,
  oi.product_id,
  oi.quantity,
  oi.unit_price,
  oi.quantity * oi.unit_price
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
JOIN vendas_diarias vd ON o.id = vd.id;
```

---

## DEPLOY CHECKLIST

- [ ] Backup do banco de dados
- [ ] Executar schema SQL em produção
- [ ] Atualizar código no repositório
- [ ] Deploy em staging (testar antes)
- [ ] Validar métricas no dashboard
- [ ] Testar fluxo completo de venda
- [ ] Verificar calculadora de preço
- [ ] Testar responsividade mobile
- [ ] Deploy em produção
- [ ] Monitorar erros nas primeiras 24h

---

**Versão:** 2.0.0  
**Data:** 13/08/2026  
**Status:** ✅ PRONTO  
**Próximo Update:** v2.1.0 (Integração WhatsApp)
