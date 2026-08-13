# API Documentation - Raio-X E-commerce

## Autenticação

Todos os endpoints autenticados requerem um header de autorização com JWT token do Supabase:

```
Authorization: Bearer <supabase-access-token>
```

## Endpoints

### Auth

#### POST /api/auth
Criar conta ou fazer login.

**Request:**
```json
{
  "action": "signup",
  "full_name": "João Silva",
  "email": "joao@example.com",
  "password": "senha123",
  "phone": "11999999999"
}
```

**Response (201 - Signup):**
```json
{
  "success": true,
  "message": "Conta criada com sucesso",
  "user": {
    "id": "uuid",
    "email": "joao@example.com",
    "workspace_slug": "joao-silva-xxx"
  }
}
```

**Request:**
```json
{
  "action": "login",
  "email": "joao@example.com",
  "password": "senha123"
}
```

**Response (200 - Login):**
```json
{
  "success": true,
  "message": "Login realizado com sucesso",
  "user": {
    "id": "uuid",
    "email": "joao@example.com"
  }
}
```

### Produtos

#### GET /api/products
Listar produtos da workspace.

**Query Parameters:**
- `workspaceId` (string) - ID da workspace
- `categoryId` (string) - Filtrar por categoria
- `page` (number) - Página (default: 1)
- `limit` (number) - Itens por página (default: 20)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Cesta Presente",
      "description": "Cesta com produtos selecionados",
      "price": 150.00,
      "image_url": "https://...",
      "is_active": true,
      "product_additionals": [
        {
          "id": "uuid",
          "name": "Embalagem Premium",
          "price": 20.00,
          "is_required": false
        }
      ]
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

#### POST /api/products
Criar novo produto. **Requer autenticação.**

**Request:**
```json
{
  "name": "Cesta Presente",
  "description": "Cesta com produtos selecionados",
  "price": 150.00,
  "categoryId": "uuid",
  "imageUrl": "https://..."
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "workspace_id": "uuid",
    "name": "Cesta Presente",
    "price": 150.00,
    "is_active": true,
    "created_at": "2024-01-01T10:00:00Z"
  }
}
```

#### PUT /api/products
Atualizar produto. **Requer autenticação.**

**Request:**
```json
{
  "id": "uuid",
  "name": "Cesta Premium",
  "price": 180.00,
  "description": "Atualizado"
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* produto atualizado */ }
}
```

#### DELETE /api/products
Deletar produto. **Requer autenticação.**

**Query Parameters:**
- `id` (string) - ID do produto

**Response:**
```json
{
  "success": true
}
```

### Pedidos

#### GET /api/orders
Listar pedidos. **Requer autenticação.**

**Query Parameters:**
- `status` (string) - draft, pending, confirmed, delivered, cancelled
- `page` (number)
- `limit` (number)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "customer_id": "uuid",
      "status": "confirmed",
      "subtotal": 150.00,
      "shipping_cost": 25.00,
      "total": 175.00,
      "delivery_date": "2024-01-15",
      "delivery_period": "afternoon",
      "notes": "Entregar com cuidado",
      "order_items": [
        {
          "id": "uuid",
          "product_id": "uuid",
          "quantity": 1,
          "unit_price": 150.00,
          "product": {
            "name": "Cesta Presente",
            "price": 150.00
          }
        }
      ]
    }
  ],
  "total": 10
}
```

#### POST /api/orders
Criar novo pedido. **Requer autenticação.**

**Request:**
```json
{
  "customerId": "uuid",
  "items": [
    {
      "productId": "uuid",
      "quantity": 1,
      "price": 150.00
    }
  ],
  "deliveryDate": "2024-01-15",
  "deliveryPeriod": "afternoon",
  "deliveryAddress": "Rua Silva, 123, São Paulo, SP",
  "notes": "Entregar com cuidado"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "customer_id": "uuid",
    "status": "pending",
    "total": 175.00,
    "created_at": "2024-01-01T10:00:00Z"
  }
}
```

#### PUT /api/orders
Atualizar pedido. **Requer autenticação.**

**Request:**
```json
{
  "orderId": "uuid",
  "status": "confirmed",
  "notes": "Atualizar notas"
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* pedido atualizado */ }
}
```

### Clientes

#### GET /api/customers
Listar clientes. **Requer autenticação.**

**Query Parameters:**
- `search` (string) - Buscar por nome, telefone ou email
- `page` (number)
- `limit` (number)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Maria Santos",
      "phone": "11987654321",
      "email": "maria@example.com",
      "date_of_birth": "1990-05-15",
      "how_knew": "Instagram",
      "total_orders": 3,
      "total_spent": 450.00,
      "last_order_at": "2024-01-01T10:00:00Z"
    }
  ],
  "total": 25
}
```

#### POST /api/customers
Criar cliente. **Requer autenticação.**

**Request:**
```json
{
  "name": "Maria Santos",
  "phone": "11987654321",
  "email": "maria@example.com",
  "dateOfBirth": "1990-05-15",
  "howKnew": "Instagram",
  "notes": "Cliente VIP"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Maria Santos",
    "phone": "11987654321"
  }
}
```

#### PUT /api/customers
Atualizar cliente. **Requer autenticação.**

**Request:**
```json
{
  "customerId": "uuid",
  "name": "Maria Santos",
  "email": "maria.santos@example.com",
  "notes": "Atualizado"
}
```

### Chat IA

#### POST /api/chat
Enviar mensagem para assistente. **Requer autenticação.**

**Request:**
```json
{
  "sessionId": "uuid",
  "workspaceId": "uuid",
  "message": "Oi, qual é o melhor presente para uma namorada?",
  "products": [
    {
      "name": "Cesta Presente",
      "description": "Cesta com produtos selecionados",
      "price": 150.00
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Olá! Temos várias opções lindas de presentes... Recomendo a Cesta Presente que é perfeita para uma namorada!",
  "stop_reason": "end_turn"
}
```

### Rotas

#### POST /api/routes/calculate
Calcular rota otimizada. **Requer autenticação.**

**Request:**
```json
{
  "addresses": [
    {
      "orderId": "uuid",
      "address": "Rua A, 123, São Paulo, SP",
      "customerName": "João Silva"
    },
    {
      "orderId": "uuid",
      "address": "Av B, 456, São Paulo, SP",
      "customerName": "Maria Santos"
    }
  ],
  "deliveryDate": "2024-01-15"
}
```

**Response:**
```json
{
  "success": true,
  "route": {
    "id": "uuid",
    "date": "2024-01-15",
    "total_distance": 12.5,
    "estimated_time": 45,
    "orders": [
      {
        "order_id": "uuid",
        "sequence": 1,
        "address": "Rua A, 123, São Paulo, SP",
        "distance_from_previous": 0,
        "estimated_time_to_next": 20
      }
    ]
  },
  "distance": 12.5,
  "duration": 45,
  "polyline": "xxxxxxx"
}
```

### WhatsApp

#### POST /api/whatsapp/send
Enviar pedido via WhatsApp. **Requer autenticação.**

**Request:**
```json
{
  "orderId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Mensagem enviada com sucesso",
  "whatsapp_message_id": "wamid.xxxxxx"
}
```

## Códigos de Erro

| Código | Mensagem | Causa |
|--------|----------|-------|
| 400 | Bad Request | Parâmetros inválidos |
| 401 | Unauthorized | Token ausente ou inválido |
| 404 | Not Found | Recurso não encontrado |
| 409 | Conflict | Recurso duplicado |
| 500 | Internal Server Error | Erro do servidor |

## Rate Limiting

- 100 requisições por minuto por IP
- 10 requisições por segundo por endpoint

## Exemplos de Uso

### JavaScript/Fetch

```javascript
// Criar conta
const response = await fetch('/api/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'signup',
    full_name: 'João Silva',
    email: 'joao@example.com',
    password: 'senha123'
  })
});

const data = await response.json();
console.log(data);
```

### Supabase Client

```typescript
import { supabase } from '@/lib/supabase';

// Listar produtos
const { data, error } = await supabase
  .from('products')
  .select('*')
  .eq('workspace_id', userId);

// Criar pedido
const { data, error } = await supabase
  .from('orders')
  .insert({
    workspace_id: userId,
    customer_id: customerId,
    status: 'pending',
    total: 175.00
  });
```

## Webhooks

### WhatsApp Webhook

Recebe eventos de mensagens entrantes.

**Endpoint:** `POST /api/whatsapp/webhook`

**Payload:**
```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "123456",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "messages": [
              {
                "from": "11987654321",
                "id": "wamid.xxx",
                "timestamp": "1234567890",
                "text": {
                  "body": "Mensagem do cliente"
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

## Notas Importantes

1. Todos os timestamps estão em ISO 8601 (UTC)
2. Valores monetários estão em centavos (sem decimal)
3. Telefones devem incluir código do país (+55 para Brasil)
4. Geocordinadas estão em formato decimal (latitude, longitude)
