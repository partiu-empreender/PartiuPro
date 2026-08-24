# Ações futuras / backlog de melhorias

Coisas que foram identificadas mas **deliberadamente adiadas**. Cada item tem o motivo do adiamento, pra não precisar redescobrir o contexto depois.

## Segurança

### Ligar "Leaked Password Protection" no Supabase Auth
- **O que é**: checagem de senha vazada (via HaveIBeenPwned) no cadastro/troca de senha — impede a aluna de usar uma senha que já vazou em outro serviço.
- **Por que está pendente**: só existe no plano **Pro** do Supabase (confirmado em [supabase.com/docs/guides/auth/password-security](https://supabase.com/docs/guides/auth/password-security): *"Leaked password protection is available on the Pro Plan and above"*). A org "Raio X" está no plano **Free** hoje. Decisão em 2026-08-24: não fazer upgrade agora.
- **Quando reconsiderar**: se decidirem fazer upgrade do Supabase por outro motivo (mais storage, backups, etc.), vale ligar esse recurso junto — o custo marginal passa a ser zero.
- **Onde fazer**: Dashboard do Supabase → Authentication → Policies/Password (não tem endpoint de API/MCP pra isso).
- Projetos afetados: `vcaxpbynkamdbxwzrklo` (Next.js/produto definitivo) e, enquanto existir, `gcmcvoubkzutpkcuaard` (Lovable).

## Migração Lovable → Next.js

Ver [`PLANO_MIGRACAO_LOVABLE.md`](./PLANO_MIGRACAO_LOVABLE.md) — plano completo, decidido em 2026-08-24 (Next.js vai substituir o Lovable). Os itens de código de lá (portar metas, atendimentos, catálogo de produtos, perfil) são trabalho de desenvolvimento ainda não iniciado — só o plano existe até aqui.
