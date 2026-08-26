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
- **Nota**: a tabela `admin_access_log` ficou sem uso — o recurso de log de acesso do admin (modal pedindo motivo antes de ver o detalhe de uma aluna) foi removido a pedido da Tania em 2026-08-26. A tabela em si é inofensiva (vazia, sem nada escrevendo nela); pode ser removida numa limpeza futura se quiserem.

### Prioridade 2 do documento de LGPD (ainda não implementada)
- Conta de demonstração fictícia pra material de divulgação (evita depender de autorização de qualquer aluna).
- Modo de captura com máscara de nomes de clientes.
- Regra de k-mínimo (n≥5) antes de exibir agregados como anonimizados.
- Job automático de retenção/expurgo (30 dias cliente final / 90 dias conta / 6 meses logs).
- Ver o documento completo "Fluxo de Aviso LGPD — Partiu PRO v5" (compartilhado pela Tania em 2026-08-26) pra detalhes de cada item.
