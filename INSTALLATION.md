# Guia de Instalação - Raio-X E-commerce

## Pré-requisitos

- Node.js 18+ e npm/yarn
- Conta Supabase
- Conta Anthropic (Claude API)
- Conta Google Cloud (Maps, Calendar)
- Conta WhatsApp Business

## Passo 1: Setup do Projeto

```bash
# Clonar repositório
git clone <seu-repositorio>
cd raio-x-ecommerce

# Instalar dependências
npm install

# Copiar arquivo de ambiente
cp .env.local.example .env.local
```

## Passo 2: Configurar Supabase

### 2.1 Criar Projeto
1. Acessar [Supabase Console](https://app.supabase.com)
2. Criar novo projeto
3. Aguardar inicialização

### 2.2 Configurar Banco de Dados
1. Ir para SQL Editor
2. Criar nova query
3. Copiar e executar o SQL de `supabase/migrations/001_init.sql`

### 2.3 Obter Credenciais
1. Ir para Project Settings > API
2. Copiar:
   - `NEXT_PUBLIC_SUPABASE_URL` (Project URL)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon key)
   - `SUPABASE_SERVICE_ROLE_KEY` (service_role key)
   - `SUPABASE_JWT_SECRET` (JWT Secret)

### 2.4 Habilitar Autenticação
1. Ir para Authentication > Providers
2. Verificar que Email é o método padrão
3. Email/Password já vem habilitado

## Passo 3: Configurar Claude API

### 3.1 Obter API Key
1. Acessar [Anthropic Console](https://console.anthropic.com)
2. Gerar nova API Key
3. Copiar valor para `ANTHROPIC_API_KEY`

## Passo 4: Configurar Google APIs

### 4.1 Google Maps
1. Acessar [Google Cloud Console](https://console.cloud.google.com)
2. Criar novo projeto
3. Ativar APIs:
   - Maps Embed API
   - Maps JavaScript API
   - Distance Matrix API
   - Directions API
   - Geocoding API
4. Criar credencial (API Key)
5. Copiar para `GOOGLE_MAPS_API_KEY`

### 4.2 Google Calendar
1. Ainda no Google Cloud Console
2. Ativar Google Calendar API
3. Criar credencial OAuth 2.0 (Desktop Application)
4. Download JSON
5. Copiar:
   - `GOOGLE_CALENDAR_CLIENT_ID`
   - `GOOGLE_CALENDAR_CLIENT_SECRET`
   - `GOOGLE_CALENDAR_API_KEY`

## Passo 5: Configurar WhatsApp Business

### 5.1 Setup WhatsApp
1. Acessar [Meta for Business](https://business.meta.com)
2. Criar Business Account (se não tiver)
3. Configurar WhatsApp Business Account

### 5.2 Obter Credenciais
1. Ir para WhatsApp > API Setup
2. Copiar:
   - `WHATSAPP_PHONE_NUMBER_ID` (Phone Number ID)
   - `WHATSAPP_BUSINESS_ACCOUNT_ID` (Business Account ID)
3. Gerar Access Token:
   - Ir para Tokens
   - Criar novo token com permissões whatsapp_business_messaging
   - Copiar para `WHATSAPP_API_TOKEN`

### 5.3 Configurar Webhook
1. Ir para App Roles
2. Adicionar URL de webhook: `https://seu-dominio.com/api/whatsapp/webhook`
3. Verify Token (copiar valor aleatório para `WHATSAPP_WEBHOOK_VERIFY_TOKEN`)
4. Ativar webhook para eventos de mensagens

## Passo 6: Configurar .env.local

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyxxxx...
SUPABASE_SERVICE_ROLE_KEY=eyxxxx...
SUPABASE_JWT_SECRET=xxxxxx

# NextAuth
NEXTAUTH_SECRET=gerar-com-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000

# Claude
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Google
GOOGLE_MAPS_API_KEY=AIzaxxxxx
GOOGLE_CALENDAR_API_KEY=AIzaxxxxx
GOOGLE_CALENDAR_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=GOCSPX-xxxxx

# WhatsApp
WHATSAPP_BUSINESS_ACCOUNT_ID=xxxxx
WHATSAPP_PHONE_NUMBER_ID=xxxxx
WHATSAPP_API_TOKEN=EAAxxxxx
WHATSAPP_WEBHOOK_VERIFY_TOKEN=xxxxx

# App
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Passo 7: Iniciar Desenvolvimento

```bash
npm run dev
```

Acesse http://localhost:3000

## Testar Funcionalidades

### 1. Criar Conta
- Acessar http://localhost:3000/auth/signup
- Preencher formulário
- Fazer login

### 2. Adicionar Produtos
- Acessar Dashboard > Produtos
- Clicar "+ Novo Produto"
- Preencher informações

### 3. Testar Chat IA
- Via storefront (teste com slug da conta)
- Enviar mensagem
- Verificar resposta Claude

### 4. Testar Cálculo de Rotas
- Criar alguns pedidos
- Dashboard > Rotas
- Selecionar data
- Clicar "Calcular Rota"

## Troubleshooting

### Erro de Autenticação Supabase
- Verificar se JWT_SECRET está correto
- Testar credenciais no Supabase Console
- Verificar CORS em Project Settings

### Claude API Error
- Verificar se API Key é válida
- Verificar limite de uso
- Testar com curl: `curl https://api.anthropic.com -H "Authorization: Bearer $ANTHROPIC_API_KEY"`

### Google Maps não funciona
- Verificar se APIs estão habilitadas
- Verificar se API Key tem restrições geográficas
- Testar URL de chamadas nos logs

### WhatsApp não envia mensagens
- Verificar token do WhatsApp
- Verificar número de telefone (formato com código país)
- Verificar webhook endpoint
- Testar em sandbox do WhatsApp primeiro

## Deploy em Produção

### Vercel
```bash
# 1. Conectar repositório GitHub
# 2. Configurar variáveis de ambiente
# 3. Deploy automático

vercel --prod
```

### Variáveis de Produção
Todas as variáveis de `.env.local` devem ser configuradas em:
- Vercel: Project Settings > Environment Variables
- Ou usar arquivo `.env.production` local

## Monitoramento

### Logs
- Supabase: Logs > Edge Function
- Vercel: Deployments > Functions
- Local: `npm run dev` mostra logs em tempo real

### Analytics
- Dashboard de vendas atualiza em tempo real
- Verificar Table > Orders para dados brutos
- SQL queries em Supabase Console para análises

## Próximos Passos

1. Customizar tema (cores, fonts)
2. Adicionar mais campos customizados
3. Integrar pagamento (Stripe/Mercado Pago)
4. Configurar backup automático Supabase
5. Implementar email marketing integrado
6. Adicionar suporte a múltiplas moedas

## Suporte

Para dúvidas, abra issue no repositório ou entre em contato.
