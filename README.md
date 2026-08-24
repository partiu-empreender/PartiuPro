# Raio-X

Painel de vendas para quem revende presentes/produtos: registra vendas do dia, calcula métricas (PA, ticket médio, faturamento) e ajuda a precificar produtos.

## O que existe hoje

- **Cadastro e login** de conta (uma conta = uma "aluna"/loja, isolada das demais)
- **Registrar venda do dia**: cliente + itens avulsos (nome, quantidade, preço — sem depender de catálogo de produto)
- **Dashboard de métricas**: vendas do dia, PA (produtos por atendimento), ticket médio, faturamento
- **Calculadora de precificação**: custo direto → despesas fixas → margem → preço sugerido
- **Painel administrativo** (`/admin`, restrito): visão consolidada de todas as alunas, para acompanhamento

Isso é o produto real, em produção. Qualquer outra coisa (cardápio público, checkout via WhatsApp, CRM, integração com IA, mapas, agenda, gateway de pagamento) é **roadmap futuro** e ainda não existe no código — não confie em documentação antiga que diga o contrário.

## Tech Stack

- **Frontend**: Next.js 14 + React 18 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes
- **Banco de dados**: Supabase (PostgreSQL) + Row Level Security
- **Autenticação**: Supabase Auth

## Setup local

```bash
git clone https://github.com/partiu-empreender/PartiuPro.git
cd PartiuPro
npm install
cp .env.local.example .env.local
```

Preencha `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

No Supabase (SQL Editor), execute o schema em `supabase/migrations/001_init_corrigido.sql` — é a única fonte de verdade do banco.

```bash
npm run dev
```

Acesse http://localhost:3000 (redireciona para `/login`).

## Estrutura de pastas

```
app/
├── (auth)/login/         # Login
├── (auth)/signup/        # Criar conta
├── admin/                # Painel administrativo (restrito a contas is_admin)
├── api/auth/             # Signup/Login
├── api/vendas/           # Registrar e listar vendas do dia
├── dashboard/            # Dashboard da aluna
components/
├── ui/                   # Componentes base
├── shared/               # Navbar, footer
├── PricingCalculator.tsx # Calculadora de precificação
lib/                      # Clientes Supabase, utilitários
types/                    # Tipos TypeScript
supabase/migrations/      # Schema do banco (fonte única de verdade)
```

## Deploy

Veja `DEPLOY_VERCEL.md` — passo a passo sem precisar mexer em nada técnico.

## Licença

Propriedade privada. Todos os direitos reservados.
