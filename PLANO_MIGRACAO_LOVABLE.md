# Plano de migração: Lovable (`negocio-raio-x`) → Next.js (`PartiuPro`)

> Decisão tomada em 2026-08-24: o app Next.js vai **substituir** o app Lovable. Este documento existe pra guiar essa transição sem perder funcionalidade nem dado de aluna.
>
> **Atualização 2026-08-25**: as 4 funcionalidades que faltavam (produtos, atendimentos, metas, perfil) foram implementadas, deployadas e validadas de ponta a ponta (schema + API + cálculos conferidos manualmente). Ver seção 6.

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
| Catálogo de produtos (nome, preço, custo, margem) | ✅ CRUD completo (`app.produtos.tsx`, tabela `produtos`) | ✅ **portado** (`/dashboard/produtos`, reaproveitando a tabela `products` já existente) | Feito e validado 2026-08-25 |
| Atendimentos diários (pessoas atendidas por dia, base da conversão) | ✅ tela dedicada (`app.atendimentos.tsx`, tabela `atendimentos_diarios`, 1 registro/dia) | ✅ **portado** (`/dashboard/atendimentos`, tabela nova `atendimentos_diarios`) | Feito e validado 2026-08-25 |
| Metas mensais + comparativo anual + gráfico de evolução | ✅ tela completa (`app.metas.tsx`, tabela `metas`) | ✅ **portado** (`/dashboard/metas`, tabela nova `metas`) | Feito e validado 2026-08-25 |
| Perfil editável (nome, trocar senha) | ✅ (`app.perfil.tsx`, também tem apelido/emoji/foto/período) | ✅ **portado** (`/dashboard/perfil`) — versão simples: só nome e senha, sem apelido/emoji/foto/período | Feito e validado 2026-08-25. Apelido/emoji/foto ficaram fora de escopo (cosmético) |
| Painel consolidado (mentor/admin vê todas as alunas) | ✅ via role `mentor` | ✅ `/admin`, via `is_admin` | Equivalente |
| Calculadora de precificação | ❌ não tem tela dedicada (só o campo custo/preço do produto) | ✅ `PricingCalculator.tsx` | Next.js está na frente aqui — nada a fazer |

## 3. Trabalho técnico necessário (fase "portar")

1. **Schema no Supabase do Next.js (`vcaxpbynkamdbxwzrklo`)**: criar `produtos`, `atendimentos_diarios` e `metas`, no mesmo espírito do schema do Lovable (`docs/supabase-setup.sql` no projeto Lovable tem o SQL de referência, incluindo RLS) — adaptando pro modelo de tabela `users`/`workspace_slug` que o Next.js já usa (não copiar `user_roles`, já existe `is_admin` fazendo esse papel).
2. **UI no Next.js**: três telas novas (produtos, atendimentos, metas) + edição de perfil, seguindo o padrão visual já usado no dashboard/admin atuais.
3. **Decisão de produto, não só técnica**: o Next.js registra venda com itens avulsos (sem catálogo obrigatório). Ao portar "produtos", decidir se o catálogo vira só uma referência de preço/custo (pra calculadora e follow-up de margem) ou se passa a ser exigido no registro de venda como no Lovable. Recomendo **manter opcional** — é a direção que o Next.js já tomou e é mais simples pra aluna.
4. **Migração de dado real**: nenhuma aluna tem histórico hoje (contas do Lovable ainda não foram recriadas, contas antigas do Next.js foram apagadas em 2026-08-24). Ou seja, **não há dado de negócio pra migrar** — todo mundo começa do zero nos dois lados. Isso simplifica bastante: não precisa de script de ETL entre bancos.

## 4. Sequência recomendada

1. ~~Portar as 3 funcionalidades faltantes (produtos, atendimentos, metas) + perfil no Next.js.~~ ✅ **Feito 2026-08-25.**
2. ~~Testar com uma conta piloto cobrindo o fluxo completo: cadastro → produtos → venda do dia → atendimento do dia → meta do mês → dashboard.~~ ✅ **Feito 2026-08-25** — validado manualmente (tela) e via API (cálculos de PA/conversão/margem conferidos número a número).
3. **→ Próximo passo.** Avisar a Tania e as alunas: novo link (`https://partiu-pro-psi.vercel.app`, ou um domínio próprio se/quando configurarem um), pedir pra criarem conta nova lá. **Antes disso**, resolver os 2 itens de segurança abertos no `ACOES_FUTURAS.md` (religar confirmação de e-mail / SMTP), senão qualquer pessoa cria conta com e-mail de qualquer um.
4. Deixar o Lovable no ar só como "modo leitura"/transição por um tempo curto (ex: 2 semanas), sem propaganda do link — evita quebrar quem ainda não migrou.
5. Depois que todo mundo migrou: despublicar o app Lovable (ou pausar a assinatura, se houver custo associado) e, se quiser, arquivar o banco `gcmcvoubkzutpkcuaard` (fazer backup antes de deletar, mesmo que hoje esteja vazio).

## 5. Pendências que travam esse plano

- Falta decidir o domínio final do Next.js (hoje só tem os `*.vercel.app` gerados) — não bloqueia começar a usar, mas é mais fácil divulgar um domínio próprio.
- Ver `ACOES_FUTURAS.md` pros itens de segurança/infra pendentes antes do passo 3 acima.

## 6. O que foi implementado (2026-08-25)

- Schema: tabelas novas `atendimentos_diarios` e `metas` (RLS completa); reaproveitada a tabela `products` já existente pro catálogo.
- Bug pré-existente corrigido: `users` tinha RLS mas só com policy de SELECT — todo signup falhava silenciosamente. Adicionadas policies de INSERT/UPDATE.
- Bug pré-existente corrigido: insert de perfil no signup rodava sem sessão ativa (antes da confirmação de e-mail) — trocado pro cliente admin nesse ponto específico.
- Bug pré-existente corrigido: redirect morto `/dashboard` → `/dashboard/overview` (página que não existe mais).
- Bug pré-existente corrigido: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` estavam desatualizadas na Vercel (de antes da recriação do banco) — corrigidas.
- Vercel Authentication (SSO) desligado — estava bloqueando qualquer acesso de quem não fosse da equipe.
- Navbar compartilhada nova (não existia navegação nenhuma entre as páginas antes).
- Dashboard corrigido: PA agora é itens ÷ atendimentos (era itens ÷ vendas) e tem card de Conversão, replicando a lógica do Lovable.
