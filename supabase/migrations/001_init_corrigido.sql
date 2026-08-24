-- ============================================
-- SCHEMA CORRIGIDO - RAIO-X E-COMMERCE
-- ============================================
-- Mudanças principais:
-- 1. Adicionadas tabelas vendas_diarias e venda_itens
-- 2. Corrigida lógica de Vendas vs Atendimentos
-- 3. Melhorada rastreamento de métricas
-- ============================================

-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  workspace_slug TEXT UNIQUE NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create product_categories table
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(workspace_id, name)
);

-- Create products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES users(id),
  category_id UUID REFERENCES product_categories(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  cost DECIMAL(10, 2) DEFAULT 0,
  image_url TEXT,
  stock INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create product_additionals table
CREATE TABLE product_additionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  is_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create customers table
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  date_of_birth DATE,
  how_knew TEXT,
  notes TEXT,
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(10, 2) DEFAULT 0,
  last_order_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(workspace_id, phone)
);

-- ============================================
-- TABELAS CORRIGIDAS PARA VENDAS
-- ============================================

-- Create vendas_diarias table
-- Um registro por CLIENTE/TRANSAÇÃO (não por produto)
CREATE TABLE vendas_diarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES users(id),
  customer_id UUID REFERENCES customers(id),
  data DATE NOT NULL,
  cliente_nome TEXT,
  bairro TEXT,
  faturamento_total DECIMAL(10, 2) NOT NULL,
  status TEXT CHECK(status IN ('draft', 'pending', 'confirmed', 'delivered', 'cancelled')) DEFAULT 'draft',
  delivery_date DATE,
  delivery_period TEXT CHECK(delivery_period IN ('morning', 'afternoon', 'evening')),
  shipping_cost DECIMAL(10, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create venda_itens table
-- Um registro por ITEM na venda (avulso, digitado na hora — sem depender de catálogo de produto)
-- Uma venda pode ter múltiplos itens
CREATE TABLE venda_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id UUID NOT NULL REFERENCES vendas_diarias(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES products(id),
  produto_nome TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create customers table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES users(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  status TEXT CHECK(status IN ('draft', 'pending', 'confirmed', 'delivered', 'cancelled')) DEFAULT 'draft',
  subtotal DECIMAL(10, 2) NOT NULL,
  shipping_cost DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  delivery_date DATE NOT NULL,
  delivery_period TEXT CHECK(delivery_period IN ('morning', 'afternoon', 'evening')) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create order_items table
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create order_additional_items table
CREATE TABLE order_additional_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  additional_id UUID NOT NULL REFERENCES product_additionals(id),
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create delivery_settings table
CREATE TABLE delivery_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES users(id),
  shipping_type TEXT CHECK(shipping_type IN ('fixed', 'per_km')) DEFAULT 'fixed',
  fixed_cost DECIMAL(10, 2),
  cost_per_km DECIMAL(10, 2),
  center_latitude DECIMAL(10, 8),
  center_longitude DECIMAL(11, 8),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create delivery_routes table
CREATE TABLE delivery_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES users(id),
  date DATE NOT NULL,
  orders JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_distance DECIMAL(10, 2),
  estimated_time INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create chat_sessions table
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES users(id),
  customer_session_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create chat_messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT CHECK(role IN ('user', 'assistant')) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create assistant_settings table
CREATE TABLE assistant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES users(id),
  name TEXT NOT NULL DEFAULT 'Assistente',
  personality TEXT NOT NULL,
  system_prompt TEXT,
  suggest_additionals BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create customer_interactions table
CREATE TABLE customer_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type TEXT CHECK(type IN ('order', 'message', 'note')) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- ENABLE RLS
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_additionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas_diarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE venda_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_additional_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_interactions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- RLS Policies for users
CREATE POLICY "Users can read their own data" ON users
  FOR SELECT USING (auth.uid() = id);

-- RLS Policies for products
CREATE POLICY "Users can read their products" ON products
  FOR SELECT USING (auth.uid() = workspace_id);

CREATE POLICY "Users can create products" ON products
  FOR INSERT WITH CHECK (auth.uid() = workspace_id);

CREATE POLICY "Users can update their products" ON products
  FOR UPDATE USING (auth.uid() = workspace_id);

CREATE POLICY "Users can delete their products" ON products
  FOR DELETE USING (auth.uid() = workspace_id);

-- RLS Policies for customers
CREATE POLICY "Users can read their customers" ON customers
  FOR SELECT USING (auth.uid() = workspace_id);

CREATE POLICY "Users can create customers" ON customers
  FOR INSERT WITH CHECK (auth.uid() = workspace_id);

CREATE POLICY "Users can update their customers" ON customers
  FOR UPDATE USING (auth.uid() = workspace_id);

-- RLS Policies for vendas_diarias
CREATE POLICY "Users can read their vendas" ON vendas_diarias
  FOR SELECT USING (auth.uid() = workspace_id);

CREATE POLICY "Users can create vendas" ON vendas_diarias
  FOR INSERT WITH CHECK (auth.uid() = workspace_id);

CREATE POLICY "Users can update their vendas" ON vendas_diarias
  FOR UPDATE USING (auth.uid() = workspace_id);

CREATE POLICY "Users can delete their vendas" ON vendas_diarias
  FOR DELETE USING (auth.uid() = workspace_id);

-- RLS Policies for venda_itens
CREATE POLICY "Users can read their venda_itens" ON venda_itens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM vendas_diarias
      WHERE vendas_diarias.id = venda_itens.venda_id
      AND vendas_diarias.workspace_id = auth.uid()
    )
  );

CREATE POLICY "Users can create venda_itens" ON venda_itens
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendas_diarias
      WHERE vendas_diarias.id = venda_itens.venda_id
      AND vendas_diarias.workspace_id = auth.uid()
    )
  );

-- RLS Policies for orders
CREATE POLICY "Users can read their orders" ON orders
  FOR SELECT USING (auth.uid() = workspace_id);

CREATE POLICY "Users can create orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() = workspace_id);

CREATE POLICY "Users can update their orders" ON orders
  FOR UPDATE USING (auth.uid() = workspace_id);

-- RLS Policies for chat
CREATE POLICY "Users can read their chat sessions" ON chat_sessions
  FOR SELECT USING (auth.uid() = workspace_id);

CREATE POLICY "Users can read their chat messages" ON chat_messages
  FOR SELECT USING (
    auth.uid() IN (
      SELECT workspace_id FROM chat_sessions WHERE id = session_id
    )
  );

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_products_workspace ON products(workspace_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_customers_workspace ON customers(workspace_id);
CREATE INDEX idx_vendas_workspace ON vendas_diarias(workspace_id);
CREATE INDEX idx_vendas_data ON vendas_diarias(data);
CREATE INDEX idx_vendas_customer ON vendas_diarias(customer_id);
CREATE INDEX idx_venda_itens_venda ON venda_itens(venda_id);
CREATE INDEX idx_venda_itens_produto ON venda_itens(produto_id);
CREATE INDEX idx_orders_workspace ON orders(workspace_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_date ON orders(delivery_date);
CREATE INDEX idx_chat_sessions_workspace ON chat_sessions(workspace_id);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
