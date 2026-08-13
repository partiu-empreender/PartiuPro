# Raio-X E-commerce

Sistema escalável de e-commerce multi-tenant para 1000+ alunas com CRM, chat IA, agenda e otimização de rotas.

## Features

- **E-commerce Completo**: Catálogo com produtos, categorias, adicionais e checkout integrado
- **Chat IA**: Assistente Claude treinado com seus produtos
- **WhatsApp Integrado**: Envie pedidos direto para WhatsApp
- **Agenda + Google Calendar**: Sincronize entregas
- **Gerador de Rotas**: Otimize suas entregas com Google Maps
- **CRM Avançado**: Gerencie clientes e histórico de pedidos
- **Dashboard Analítico**: Vendas, faturamento e métricas em tempo real

## Tech Stack

- **Frontend**: Next.js 14 + React 18 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL) + Row Level Security
- **Authentication**: Supabase Auth
- **APIs Externas**:
  - Claude 3.5 Sonnet (Chat IA)
  - Google Maps (Rotas e Geocoding)
  - Google Calendar (Agenda)
  - WhatsApp Business API (Mensagens)

## Setup Local

### 1. Clonar repositório
```bash
git clone <repositorio>
cd raio-x-ecommerce
npm install
```

### 2. Configurar variáveis de ambiente
```bash
cp .env.local.example .env.local
```

Preencha os valores em `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_key
ANTHROPIC_API_KEY=your_key
GOOGLE_MAPS_API_KEY=your_key
WHATSAPP_API_TOKEN=your_token
```

### 3. Configurar Supabase

```bash
# Criar tabelas (execute o SQL em migrations/001_init.sql)
# Acessar: https://app.supabase.com/project/_/sql
```

### 4. Iniciar desenvolvimento

```bash
npm run dev
```

Acesse http://localhost:3000

## Arquitetura

### Banco de Dados

```
users (autenticação + workspace)
├── product_categories
├── products
│   └── product_additionals
├── customers
│   ├── orders
│   │   ├── order_items
│   │   └── order_additional_items
│   └── customer_interactions
├── delivery_settings
├── delivery_routes
├── chat_sessions
│   └── chat_messages
└── assistant_settings
```

### Segurança (RLS)

- Cada usuário só acessa seus dados
- Row Level Security habilitado em todas as tabelas
- JWT autenticação via Supabase Auth
- Rate limiting (implementar)

## API Routes

### Auth
- `POST /api/auth` - Signup/Login

### Produtos
- `GET /api/products` - Listar
- `POST /api/products` - Criar
- `PUT /api/products` - Atualizar
- `DELETE /api/products` - Deletar

### Pedidos
- `GET /api/orders` - Listar
- `POST /api/orders` - Criar
- `PUT /api/orders` - Atualizar

### Clientes
- `GET /api/customers` - Listar
- `POST /api/customers` - Criar
- `PUT /api/customers` - Atualizar

### Chat
- `POST /api/chat` - Enviar mensagem

### Rotas
- `POST /api/routes/calculate` - Calcular rota

### WhatsApp
- `POST /api/whatsapp/send` - Enviar pedido

## Estrutura de Pastas

```
raio-x-ecommerce/
├── app/
│   ├── (auth)/              # Páginas de autenticação
│   ├── (dashboard)/         # Painel do usuário
│   ├── api/                 # Rotas da API
│   ├── storefront/          # Catálogo público
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/                  # Componentes base
│   └── shared/              # Componentes reutilizáveis
├── lib/
│   ├── supabase.ts
│   ├── claude.ts
│   ├── whatsapp.ts
│   ├── google-maps.ts
│   ├── google-calendar.ts
│   └── utils.ts
├── types/
│   └── index.ts
├── supabase/
│   └── migrations/
└── public/
```

## Deployment

### Vercel

```bash
vercel --prod
```

Variáveis de ambiente devem ser configuradas no painel da Vercel.

### Docker

```bash
docker build -t raio-x-ecommerce .
docker run -p 3000:3000 raio-x-ecommerce
```

## Performance

- Image optimization habilitada
- Code splitting automático
- Cache com TTL de 5 minutos
- Database indexes em colunas importantes
- Lazy loading de componentes

## Próximos Passos

- [ ] Implementar pagina de storefront (catálogo público)
- [ ] Integrar Stripe/Mercado Pago para pagamentos
- [ ] Adicionar upload de imagens (AWS S3)
- [ ] Implementar dashboard de analytics avançado
- [ ] Adicionar sistema de cupons/descontos
- [ ] Implementar notificações push
- [ ] Adicionar exportação de dados (CSV/Excel)
- [ ] Melhorar sugestões IA com recomendações de produtos

## Suporte

Para dúvidas ou problemas, abra uma issue no repositório.

## Licença

Propriedade privada. Todos os direitos reservados.
