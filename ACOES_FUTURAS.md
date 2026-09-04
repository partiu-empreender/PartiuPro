# Ações futuras / backlog de melhorias

Coisas que foram identificadas mas **deliberadamente adiadas**. Cada item tem o motivo do adiamento, pra não precisar redescobrir o contexto depois.

## Segurança

### Ligar "Leaked Password Protection" no Supabase Auth
- **O que é**: checagem de senha vazada (via HaveIBeenPwned) no cadastro/troca de senha — impede a aluna de usar uma senha que já vazou em outro serviço.
- **Por que está pendente**: só existe no plano **Pro** do Supabase (confirmado em [supabase.com/docs/guides/auth/password-security](https://supabase.com/docs/guides/auth/password-security): *"Leaked password protection is available on the Pro Plan and above"*). A org "Raio X" está no plano **Free** hoje. Decisão em 2026-08-24: não fazer upgrade agora.
- **Quando reconsiderar**: se decidirem fazer upgrade do Supabase por outro motivo (mais storage, backups, etc.), vale ligar esse recurso junto — o custo marginal passa a ser zero.
- **Onde fazer**: Dashboard do Supabase → Authentication → Policies/Password (não tem endpoint de API/MCP pra isso).
- Projetos afetados: `vcaxpbynkamdbxwzrklo` (Next.js/produto definitivo) e, enquanto existir, `gcmcvoubkzutpkcuaard` (Lovable).

## Infraestrutura

### Configurar SMTP customizado no Supabase Auth (e-mail de confirmação)
- **O que é**: o Supabase usa por padrão um servidor de e-mail próprio pra confirmação de cadastro/reset de senha, com um limite muito baixo de envios por hora no plano Free (alguns poucos e-mails/hora).
- **Por que importa**: descoberto em 2026-08-24 testando o signup em produção — bati o limite só com testes manuais, antes mesmo de qualquer aluna real se cadastrar. Se várias alunas criarem conta no mesmo dia (ex.: início de turma), algumas vão receber "email rate limit exceeded" e não conseguir se cadastrar.
- **Correção**: configurar um provedor de SMTP próprio no Supabase (Authentication → Emails → SMTP Settings) — ex. Resend, que já está no catálogo de integrações usado no outro produto (Lovable). Tem plano free generoso o suficiente pro volume desse app.
- **Por que está pendente**: não é bloqueante pro uso atual (poucas contas), e configurar SMTP requer decidir/criar conta num provedor de e-mail — decisão de custo/ferramenta, não só código.
- Projeto afetado: `vcaxpbynkamdbxwzrklo`.

### Religar "Confirm email" no Supabase Auth antes de divulgar pras alunas
- **O que é**: em 2026-08-25, desligamos temporariamente a exigência de confirmação de e-mail (Authentication → Providers → Email → "Confirm email") só pra conseguir testar o cadastro sem esbarrar no limite de envio de e-mail (item acima).
- **Por que importa**: com isso desligado, qualquer pessoa pode criar conta com um e-mail que não é dela (não há verificação nenhuma). Antes de mandar o link pra Tania/alunas de verdade, religar essa opção — ou, melhor ainda, resolver o SMTP customizado primeiro (item acima) e religar junto.
- Projeto afetado: `vcaxpbynkamdbxwzrklo`.

## Migração Lovable → Next.js

Ver [`PLANO_MIGRACAO_LOVABLE.md`](./PLANO_MIGRACAO_LOVABLE.md) — plano completo, decidido em 2026-08-24 (Next.js vai substituir o Lovable). Os itens de código de lá (portar metas, atendimentos, catálogo de produtos, perfil) são trabalho de desenvolvimento ainda não iniciado — só o plano existe até aqui.

## LGPD — consentimento e privacidade

### Preencher CNPJ e e-mail de contato de privacidade nos textos legais
- **O que é**: `lib/legal.ts` tem os textos do aviso de signup e da Política de Privacidade completa (`app/politica-privacidade`), mas dois campos ficaram como placeholder: `CNPJ_PONTE` e `EMAIL_PRIVACIDADE`.
- **Por que está pendente**: decisão explícita da Tania em 2026-08-26 — implementar agora com placeholder, preencher os dados reais antes de divulgar.
- **Onde fazer**: editar as constantes `CNPJ_PONTE` e `EMAIL_PRIVACIDADE` em `lib/legal.ts`.
- **Bloqueia**: divulgar o link do app pras alunas — os textos legais não podem ir ao ar com placeholder visível.

### Migration `004_lgpd_consent.sql` — já aplicada (2026-08-26)
- Criou `terms_acceptances`, `marketing_consents` e `admin_access_log`, e trocou as FKs que apontam pra `users(id)` (inclusive `users.id → auth.users(id)`) pra `ON DELETE CASCADE`.
- **Nota**: a tabela `admin_access_log` ficou sem uso — o recurso de log de acesso do admin (modal pedindo motivo antes de ver o detalhe de uma aluna) foi removido a pedido da Tania em 2026-08-26. **Resolvido**: a tabela foi removida na migration `012_remover_admin_access_log.sql` (2026-09-04), vazia e sem nada escrevendo nela. O motivo de não deixar quieto: o comentário da 004 descrevia no presente um comportamento inexistente, e uma revisão o leu como promessa de transparência não cumprida.

### Prioridade 2 do documento de LGPD (ainda não implementada)
- Conta de demonstração fictícia pra material de divulgação (evita depender de autorização de qualquer aluna).
- Modo de captura com máscara de nomes de clientes.
- Regra de k-mínimo (n≥5) antes de exibir agregados como anonimizados.
- Job automático de retenção/expurgo (30 dias cliente final / 90 dias conta / 6 meses logs).
- Ver o documento completo "Fluxo de Aviso LGPD — Partiu PRO v5" (compartilhado pela Tania em 2026-08-26) pra detalhes de cada item.

## CRM: Lead, Cliente e Presenteado — a conversar com a Tania

Levantado a partir de feedbacks reais de alunas em **04/09/2026** (grupo de
WhatsApp). Adiado de propósito: é o maior pedido em aberto, muda o modelo de
dados do CRM e precisa de validação com a Tania antes de virar código. O que
foi entregue na mesma rodada foi só o que não dependia dessa decisão (excluir
venda e ver o Raio-X de meses anteriores).

### O que as alunas pediram, na palavra delas

> "cadastro do cliente com mais informações"

> "cadastro dos atendimentos com mais informações (Nome | Contato | Origem
> (Anúncio, Instagram, Google, Indicação etc.)"

> "incluir cadastro do pedido (pedido/venda é diferente de cliente)"

> "O ideal é que o cadastro do 'cliente' começasse como Lead/Prospect com menos
> informações — só do atendimento — e pudesse evoluir para 'Cliente' quando
> houvesse um pedido/venda. Assim teríamos um cadastro CRM com clientes (já
> compraram) e leads (ainda não compraram). Além dos dados dos Presenteados,
> que viram Leads e podem virar Clientes."

> "Seria bom na hora de cadastrar os pedidos, pesquisar nos dados dos Leads,
> Clientes e Presenteados para trazer essas informações automáticas e preencher
> o restante."

> "Se houvesse uma forma de 'customizar', seria fantástico. Assim cada empresa
> poderia ter um cadastro mais ou menos completo, incluindo campos."

### O formulário que uma aluna já usa hoje (Google Forms)

É a referência concreta que ela mandou — vale como espelho do que o sistema
precisaria cobrir para substituir a planilha dela.

**Dados do cliente:** nome · telefone · e-mail · endereço · complemento ·
bairro · cidade · aniversário · etiquetas · contexto · como conheceu a empresa
(Instagram / Google / Indicação / Outros)

**Dados do pedido:** carimbo de data/hora · nome do cliente · contato do
cliente · nome do produto no catálogo · **nome da(o) presenteada(o)** ·
**contato da(o) presenteada(o)** · **endereço da(o) presenteada(o)** ·
complemento · bairro · cidade · ocasião do presente · data da entrega · período
da entrega · mensagem curta do cartão · valor dos presentes · valor dos
adicionais · valor do frete · pagamento realizado · como conheceu a empresa

**Dados internos:** código do pedido · número do pedido no mês · pediu feedback
no Google ao cliente? · foi feito? · pediu feedback ao presenteado? · foi feito?

### O que o banco já tem (e não custa nada expor)

Antes de criar coisa nova, vale saber que boa parte já existe e só não aparece
na tela:

- `customers` já tem **`email`**, **`date_of_birth`** (aniversário) e
  **`how_knew`** (como conheceu) — e `app/api/clientes/route.ts` já aceita os
  três. Só o formulário não os oferece.
- `vendas_diarias` já tem **`delivery_date`**, **`delivery_period`**,
  **`shipping_cost`**, **`bairro`** e **`notes`** — nenhum aparece no formulário
  de venda.
- `customers.notes` é o "contexto", e as etiquetas de cliente e de ocasião já
  existem (migrations 007 e 010).

Ou seja: **expor os campos existentes já atende uma parte relevante do pedido
sem migration nenhuma.** Foi a opção oferecida e adiada junto com o resto — vale
retomar como primeiro passo quando o assunto voltar, porque é barato.

### O que exigiria decisão de modelo

1. **Lead vs. Cliente.** Hoje `customers` não tem status: toda pessoa cadastrada
   é igual. Distinguir quem já comprou de quem só foi atendida mexe nos filtros
   existentes (`lib/filtros-clientes.ts`) e no "Nunca compraram", que hoje já faz
   parte desse trabalho por outro caminho (`total_orders = 0`). **Pergunta pra
   Tania:** o filtro atual já resolve, ou o status explícito muda como ela
   trabalha?
2. **Presenteado.** Não existe nada hoje. Seria tabela nova ou colunas na venda —
   e a decisão importa porque a mesma pessoa presenteada pode virar cliente
   depois, que é justamente o que a aluna descreveu.
3. **Campos customizáveis.** É o item mais caro de todos: vira um construtor de
   formulários, com armazenamento dinâmico e telas que se adaptam. Recomendação:
   deixar por último, e só depois de ver se os campos fixos não bastam.

### Cuidado de LGPD que este pedido levanta

A Política de Privacidade atual ([lib/legal.ts](lib/legal.ts), item 5) orienta a
aluna a **registrar o mínimo** sobre clientes finais — "apelido ou primeiro nome
são suficientes. Não registre CPF, telefone, e-mail ou endereço de clientes".

O pedido vai na direção oposta: endereço completo do presenteado, contato, etc.
Não é impeditivo — é dado legítimo para operar uma entrega —, mas **a política
precisa ser revista junto** se esses campos entrarem, senão o sistema passa a
pedir exatamente o que o próprio texto legal diz para não registrar. Envolver a
Tania e quem redigiu o documento.
