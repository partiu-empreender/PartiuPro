# 📊 GUIA VISUAL - RAIO-X v2.0

## 1️⃣ ESTRUTURA DO BANCO DE DADOS (VISUAL)

### Antes ❌ (Errado)
```
TABLE orders
┌───────────────────────────────────────┐
│ id  │ customer │ product │ qty │ total│
├─────┼──────────┼─────────┼─────┼──────┤
│ 1   │ João     │ Bolo    │ 1   │ 100  │ ← VENDA 1
│ 2   │ João     │ Suco    │ 1   │ 50   │ ← VENDA 2 (MESMO CLIENTE!)
│ 3   │ João     │ Doce    │ 1   │ 30   │ ← VENDA 3 (MESMO CLIENTE!)
└─────┴──────────┴─────────┴─────┴──────┘

PROBLEMA: 3 linhas = 3 VENDAS
         Mas é 1 cliente comprando 3 produtos!
         ❌ Metrics erradas!
```

### Depois ✅ (Correto)
```
TABLE vendas_diarias
┌────────┬──────────┬─────────────────┐
│ id     │ customer │ faturamento     │
├────────┼──────────┼─────────────────┤
│ venda1 │ João     │ 180 (100+50+30) │ ← 1 VENDA (1 cliente)
└────────┴──────────┴─────────────────┘

TABLE venda_itens
┌───────┬──────────┬─────────┬──────┬────────┐
│ id    │ venda_id │ produto │ qtd  │ preço  │
├───────┼──────────┼─────────┼──────┼────────┤
│ item1 │ venda1   │ Bolo    │ 1    │ 100    │
│ item2 │ venda1   │ Suco    │ 1    │ 50     │
│ item3 │ venda1   │ Doce    │ 1    │ 30     │
└───────┴──────────┴─────────┴──────┴────────┘

VANTAGEM: 1 venda ✅
          3 itens = 3 produtos
          Metrics corretas! ✅
```

---

## 2️⃣ FLUXO DE CÁLCULO DE MÉTRICAS

### Antes (Incorreto) ❌
```
Usuário vê dashboard
        ↓
Sistema conta linhas em order_items
        ↓
Resultado:
├─ Atendimentos: X
├─ Vendas: Y (muito maior que X!)
├─ PA: confuso
└─ Ticket: errado

EXEMPLO REAL:
- 5 clientes
- Cada um comprou 3 produtos
- Sistema contava: 15 VENDAS
- PA: 15 / 5 = 3 (por coincidência acertava)
- Mas VENDAS = 15 estava MUITO ERRADO!
```

### Depois (Correto) ✅
```
Usuário vê dashboard
        ↓
Sistema conta registros em vendas_diarias
        ↓
Sistema conta itens em venda_itens
        ↓
Resultado:
├─ Atendimentos: 5 clientes
├─ Vendas: 5 transações ✅
├─ PA: 15 itens / 5 vendas = 3.0
└─ Ticket: R$ XXX / 5 vendas

EXEMPLO REAL:
- 5 clientes
- Cada um comprou 3 produtos
- Sistema conta: 5 VENDAS ✅
- PA: 15 / 5 = 3.0 ✅
- Ticket: total / 5 = correto! ✅
```

---

## 3️⃣ DASHBOARD - LAYOUT DAS 5 ABAS

```
┌──────────────────────────────────────────────────────────────┐
│  Dashboard de Vendas                      [+ Registrar Venda] │
├──────────────────────────────────────────────────────────────┤
│ [Métricas] [Vendas do Dia] [Precificação] [Custos] [Lucro]  │
└──────────────────────────────────────────────────────────────┘

ABA 1: MÉTRICAS
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ 👥           │ 🛍️           │ 📦           │ 💰           │
│ Atendimentos │ Vendas       │ PA           │ Ticket Médio │
│ 5            │ 5            │ 3.00         │ R$ 210,00    │
└──────────────┴──────────────┴──────────────┴──────────────┘

[Gráfico de Faturamento por Hora]    [Gráfico Atend. vs Vendas]
[Informações Adicionais]

ABA 2: VENDAS DO DIA
┌────────────────────────────────────────────────────────────┐
│ Cliente              │ Produtos │ Status    │ Faturamento  │
├────────────────────────────────────────────────────────────┤
│ João Silva           │ 3        │ draft     │ R$ 180,00    │
│ Maria Santos         │ 1        │ pending   │ R$ 85,50     │
│ Pedro Costa          │ 2        │ confirmed │ R$ 250,00    │
└────────────────────────────────────────────────────────────┘

ABA 3: PRECIFICAÇÃO
[Passo 1: Custo Direto]     → [Passo 2: Despesas Fixas]
        ↓
[Passo 3: Margem de Lucro]  → [Passo 4: Calculadora Interativa]
        ↓
     [Passo 5: Exemplo Real]

ABA 4: CUSTOS
┌────────────────────────────────────┐
│ Custo Total de Produção  │ R$ 0,00 │
│ Despesas Fixas          │ R$ 0,00 │
├────────────────────────────────────┤
│ CUSTO TOTAL DO DIA      │ R$ 0,00 │
└────────────────────────────────────┘

ABA 5: LUCRO
┌──────────┬──────────┬──────────┐
│ Faturamento │ Custos │ Lucro    │
│ R$ 1.050,00 │ R$ 0,00│ R$ 1.050 │
└──────────┴──────────┴──────────┘
Margem: 0% (ativar custos para calcular)
```

---

## 4️⃣ CALCULADORA DE PRECIFICAÇÃO - PASSO A PASSO

### Entrada do Usuário
```
┌────────────────────────────────────────┐
│ Custo Direto: [75.16              ]    │
│ Despesas Fixas: [20% ▼]                │
│                                        │
│ Margem desejada:                       │
│ [Moderada] [Recomendado] [Premium]    │
│   80%        90%*          100%        │
│          [Alto valor]                  │
│            120%                        │
└────────────────────────────────────────┘
```

### Cálculo em Tempo Real
```
Custo Direto           R$ 75,16
+ Custo Fixo (25%)     R$ 18,79
= Subtotal             R$ 93,95
+ Margem (90%)         R$ 85,05
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
= PREÇO FINAL          R$ 178,51

💡 Dica: Arredondar para R$ 179 ou R$ 180
```

---

## 5️⃣ MODAL "REGISTRAR VENDA" - NOVO FLUXO

```
┌────────────────────────────────────────┐
│ Registrar Venda                     [X] │
├────────────────────────────────────────┤
│ Cliente (obrigatório):                 │
│ [João Silva              ▼]             │
│                                        │
│ Bairro (opcional):                     │
│ [Centro                    ]            │
│                                        │
│ Produtos Selecionados:                 │
│ ☑ Bolo x 1 - R$ 100,00                │
│ ☑ Suco x 2 - R$ 50,00                 │
│ ☑ Doce x 1 - R$ 30,00                 │
│                                        │
│ Frete (opcional):                      │
│ [10.00                     ]            │
│                                        │
│ Total: R$ 190,00                       │
│                                        │
│ [Cancelar]                 [Confirmar] │
└────────────────────────────────────────┘
```

### Processamento Backend
```
POST /api/vendas
  ↓
1. Criar registro em vendas_diarias
   └─ id: uuid
      customer_id: joão
      faturamento: 190
      
2. Criar 3 registros em venda_itens
   ├─ item1: bolo x1 = 100
   ├─ item2: suco x2 = 50
   └─ item3: doce x1 = 30
   
3. Atualizar customer metrics
   └─ total_orders++
      total_spent += 190
      
4. Retornar sucesso
   └─ Dashboard se atualiza
```

---

## 6️⃣ COMPARAÇÃO DE MÉTRICAS

### Exemplo: 3 clientes, vendas ao longo do dia

**Dados Reais:**
- João compra: Bolo + Suco (R$ 150)
- Maria compra: Doce + Café (R$ 85)  
- Pedro compra: Biscoito (R$ 50)

**ANTES (Errado) ❌**
```
Atendimentos: 3
Vendas: 5 (❌ contava os 5 produtos como vendas!)
PA: 5 / 3 = 1.67
Faturamento: R$ 285
Ticket: R$ 285 / 5 = R$ 57 (❌ errado!)
```

**DEPOIS (Correto) ✅**
```
Atendimentos: 3
Vendas: 3 (✅ 3 transações!)
PA: 5 / 3 = 1.67 (✅ mesmo resultado, mas por motivo certo!)
Faturamento: R$ 285
Ticket: R$ 285 / 3 = R$ 95 (✅ correto!)
```

---

## 7️⃣ PRECIFICAÇÃO - TRIÂNGULO DA ESTRATÉGIA

```
          🎯 CUSTO
         /    |    \
        /     |     \
       /      |      \
   VOCÊ    POSICION-  MERCADO
   QUER    AMENTO    (Concorrência)
   
   Popular    ↔     Intermediária    ↔     Premium
   
   Margem:
   - Popular:      80%
   - Intermediária: 90% ⭐ RECOMENDADO
   - Premium:      100-120%
```

---

## 8️⃣ FLUXO COMPLETO DO DIA

```
MANHÃ
  ├─ Cliente A chega
  └─ [Registra Venda] → 1 Venda, 2 Itens, R$ 100
       
MEIO DO DIA
  ├─ Cliente B chega
  └─ [Registra Venda] → 2ª Venda, 3 Itens, R$ 180
  
  ├─ Dashboard mostra:
  └─ Atendimentos: 2 | Vendas: 2 | PA: 2.5 | Faturamento: R$ 280

TARDE
  ├─ Cliente C + Cliente A novamente
  └─ [Registra 2 Vendas] → 2 + 1 = 3 Itens, R$ 150
  
  ├─ Dashboard mostra:
  └─ Atendimentos: 3 | Vendas: 3 | PA: 2.67 | Faturamento: R$ 430

RESUMO DO DIA
  ├─ Atendimentos: 3 (clientes únicos)
  ├─ Vendas: 3 (transações)
  ├─ Total de itens: 8
  ├─ PA: 2.67 (8 itens / 3 vendas)
  ├─ Faturamento: R$ 430
  └─ Ticket Médio: R$ 143,33
```

---

## 9️⃣ PRECIFICAÇÃO - EXEMPLO PRÁTICO

### Seu Produto: Café da Manhã Gourmet

```
CUSTO DIRETO (+ ou -)
  Bebidas        R$ 12,50
  Alimentos      R$ 45,00
  Embalagem      R$ 12,00
  Acabamento     R$ 5,66
  ────────────────────────
  SUBTOTAL:      R$ 75,16

DESPESAS FIXAS (÷ quantidade)
  Aluguel, luz, etc (25%) = R$ 18,79
  ────────────────────────
  TOTAL CUSTO:   R$ 93,95

MARGEM (escolha sua estratégia)
  80%  → Preço: R$ 169,00 (fácil vender, margem baixa)
  90%  → Preço: R$ 179,00 ⭐ IDEAL
  100% → Preço: R$ 188,00 (mais premium)
  120% → Preço: R$ 207,00 (ultra premium)

DECISÃO: 90% = R$ 179,00
```

---

## 🔟 CHECKLIST - VALIDAÇÃO DO SISTEMA

```
FUNCIONALIDADES
[ ] Dashboard mostra 5 abas principais
[ ] Métricas calculadas corretamente
    [ ] Atendimentos = clientes únicos
    [ ] Vendas = transações
    [ ] PA = itens / vendas
    [ ] Ticket = faturamento / vendas

REGISTRO DE VENDAS
[ ] Modal permite múltiplos produtos
[ ] Calcula faturamento total corretamente
[ ] Cria 1 venda + N itens
[ ] Atualiza métricas do cliente

CALCULADORA
[ ] Passo 1: Custo Direto
[ ] Passo 2: Despesas Fixas
[ ] Passo 3: Margem de Lucro
[ ] Passo 4: Calculadora Interativa
[ ] Passo 5: Exemplo Real

BANCO DE DADOS
[ ] vendas_diarias criada
[ ] venda_itens criada
[ ] RLS configurado
[ ] Índices criados
[ ] Dados migrados (se houver)

PERFORMANCE
[ ] Carregar vendas do dia < 1s
[ ] Gráficos renderizam suavemente
[ ] Calculadora em tempo real
[ ] Mobile responsivo
```

---

**Versão:** 2.0.0 Visual Guide  
**Status:** ✅ COMPLETO
