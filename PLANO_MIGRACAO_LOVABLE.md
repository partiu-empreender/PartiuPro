# Plano de migração: Lovable (`negocio-raio-x`) → Next.js (`PartiuPro`)

> Decisão tomada em 2026-08-24: o app Next.js vai **substituir** o app Lovable. Este documento existe pra guiar essa transição sem perder funcionalidade nem dado de aluna. Ninguém executou os passos de código ainda — é plano, não changelog.

## 1. Estado hoje

| | Lovable (`negocio-raio-x`) | Next.js (`PartiuPro`) |
|---|---|---|
| Quem usa | As alunas de verdade, hoje | Ninguém ainda (banco zerado) |
| Hospedagem | `negocio-raio-x.lovable.app` (Lovable Cloud) | Vercel (`partiu-pro-psi.vercel.app`) |
| Banco | `gcmcvoubkzutpkcuaard` | `vcaxpbynkamdbxwzrklo` |
| Stack | TanStack Start + Supabase | Next.js 14 + Supabase |

## 2. Comparativo de funcionalidades (gap real, lido no código dos dois)

| Funcionalidade | Lovable | Next.js | Ação |
|---|---|---|---|
| Login / cadastro | ✅ email+senha, role aluna/mentor (`user_roles`) | ✅ email+senha, flag `is_admin` | Equivalente, só nomenclatura diferente |
| Registrar venda do dia | ✅ itens **vinculados a produto cadastrado** (`produto_id` obrigatório) | ✅ itens **avulsos**, sem depender de catálogo | Next.js já decidiu um caminho mais simples (README explica isso como escolha deliberada) — **manter a abordagem do Next.js**, não portar a obrigatoriedade de catálogo |
| Catálogo de produtos (nome, preço, custo, margem) | ✅ CRUD completo (`app.produtos.tsx`, tabela `produtos`) | ❌ não existe como entidade — só a calculadora avulsa (`PricingCalculator.tsx`) | **Falta portar** |
| Atendimentos diários (pessoas atendidas por dia, base da conversão) | ✅ tela dedicada (`app.atendimentos.tsx`, tabela `atendimentos_diarios`, 1 registro/dia) | ❌ não existe — o "PA" do Next.js é média de itens por venda, não conversão. Não há registro de quem foi abordado e não comprou | **Falta portar** |
| Metas mensais + comparativo anual + gráfico de evolução | ✅ tela completa (`app.metas.tsx`, tabela `metas`) | ❌ não existe | **Falta portar** |
| Perfil editável (nome, apelido, emoji, foto, período, trocar email/senha) | ✅ (`app.perfil.tsx`) | ❌ não existe | **Falta portar** (pode ser versão simples: nome + trocar senha) |
| Painel consolidado (mentor/admin vê todas as alunas) | ✅ via role `mentor` | ✅ `/admin`, via `is_admin` | Equivalente |
| Calculadora de precificação | ❌ não tem tela dedicada (só o campo custo/preço do produto) | ✅ `PricingCalculator.tsx` | Next.js está na frente aqui — nada a fazer |

## 3. Trabalho técnico necessário (fase "portar")

1. **Schema no Supabase do Next.js (`vcaxpbynkamdbxwzrklo`)**: criar `produtos`, `atendimentos_diarios` e `metas`, no mesmo espírito do schema do Lovable (`docs/supabase-setup.sql` no projeto Lovable tem o SQL de referência, incluindo RLS) — adaptando pro modelo de tabela `users`/`workspace_slug` que o Next.js já usa (não copiar `user_roles`, já existe `is_admin` fazendo esse papel).
2. **UI no Next.js**: três telas novas (produtos, atendimentos, metas) + edição de perfil, seguindo o padrão visual já usado no dashboard/admin atuais.
3. **Decisão de produto, não só técnica**: o Next.js registra venda com itens avulsos (sem catálogo obrigatório). Ao portar "produtos", decidir se o catálogo vira só uma referência de preço/custo (pra calculadora e follow-up de margem) ou se passa a ser exigido no registro de venda como no Lovable. Recomendo **manter opcional** — é a direção que o Next.js já tomou e é mais simples pra aluna.
4. **Migração de dado real**: nenhuma aluna tem histórico hoje (contas do Lovable ainda não foram recriadas, contas antigas do Next.js foram apagadas em 2026-08-24). Ou seja, **não há dado de negócio pra migrar** — todo mundo começa do zero nos dois lados. Isso simplifica bastante: não precisa de script de ETL entre bancos.

## 4. Sequência recomendada

1. Portar as 3 funcionalidades faltantes (produtos, atendimentos, metas) + perfil no Next.js.
2. Testar com uma conta piloto (ex: a sua, `pontementoring@gmail.com`, recriando a conta) cobrindo o fluxo completo: cadastro → produtos → venda do dia → atendimento do dia → meta do mês → dashboard → admin vendo a aluna piloto.
3. Avisar a Tania e as alunas: novo link (o domínio do Next.js na Vercel, ou um domínio próprio se/quando configurarem um), pedir pra criarem conta nova lá.
4. Deixar o Lovable no ar só como "modo leitura"/transição por um tempo curto (ex: 2 semanas), sem propaganda do link — evita quebrar quem ainda não migrou.
5. Depois que todo mundo migrou: despublicar o app Lovable (ou pausar a assinatura, se houver custo associado) e, se quiser, arquivar o banco `gcmcvoubkzutpkcuaard` (fazer backup antes de deletar, mesmo que hoje esteja vazio).

## 5. Pendências que travam esse plano

- Ninguém decidiu ainda **quando** começar a portar as 3 telas — é a próxima conversa a ter.
- Falta decidir o domínio final do Next.js (hoje só tem os `*.vercel.app` gerados).
