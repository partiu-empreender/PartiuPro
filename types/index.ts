// User & Auth
export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  workspace_slug: string;
  created_at: string;
}

// Products
export interface ProductCategory {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  icon?: string;
  order_index: number;
  created_at: string;
}

export interface Product {
  id: string;
  workspace_id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  image_url?: string;
  stock?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductAdditional {
  id: string;
  product_id: string;
  name: string;
  price: number;
  is_required: boolean;
}

// Orders
export interface Order {
  id: string;
  workspace_id: string;
  customer_id: string;
  status: 'draft' | 'pending' | 'confirmed' | 'delivered' | 'cancelled';
  subtotal: number;
  shipping_cost: number;
  total: number;
  delivery_date: string;
  delivery_period: 'morning' | 'afternoon' | 'evening';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  additional_items?: OrderAdditionalItem[];
}

export interface OrderAdditionalItem {
  id: string;
  order_item_id: string;
  additional_id: string;
  price: number;
}

// Customers / CRM
export interface Customer {
  id: string;
  workspace_id: string;
  name: string;
  phone: string;
  email?: string;
  date_of_birth?: string;
  how_knew: string;
  notes?: string;
  total_orders: number;
  total_spent: number;
  last_order_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerInteraction {
  id: string;
  customer_id: string;
  type: 'order' | 'message' | 'note';
  content: string;
  created_at: string;
}

// Delivery
export interface DeliverySettings {
  id: string;
  workspace_id: string;
  shipping_type: 'fixed' | 'per_km';
  fixed_cost?: number;
  cost_per_km?: number;
  center_latitude?: number;
  center_longitude?: number;
  updated_at: string;
}

export interface DeliveryRoute {
  id: string;
  workspace_id: string;
  date: string;
  orders: RouteOrder[];
  total_distance: number;
  estimated_time: number;
  created_at: string;
  updated_at: string;
}

export interface RouteOrder {
  order_id: string;
  sequence: number;
  address: string;
  latitude: number;
  longitude: number;
  distance_from_previous: number;
  estimated_time_to_next: number;
}

// Chat & AI
export interface ChatSession {
  id: string;
  workspace_id: string;
  customer_session_id: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface AssistantSettings {
  id: string;
  workspace_id: string;
  name: string;
  personality: string;
  system_prompt: string;
  suggest_additionals: boolean;
  updated_at: string;
}

// Form Data
export interface CheckoutFormData {
  customer: {
    name: string;
    phone: string;
    email?: string;
    date_of_birth?: string;
  };
  gift_info: {
    for_whom: string;
    reason: string;
    recipient_contact?: string;
  };
  delivery: {
    date: string;
    period: 'morning' | 'afternoon' | 'evening';
  };
  how_knew: string;
  notes?: string;
}

// API Responses
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Dashboard
export interface DashboardStats {
  total_revenue: number;
  total_orders: number;
  new_customers: number;
  returning_customers: number;
  conversion_rate: number;
  average_order_value: number;
}

export interface SalesData {
  date: string;
  revenue: number;
  orders: number;
}

export interface ProductStats {
  product_id: string;
  product_name: string;
  quantity_sold: number;
  revenue: number;
  popular_additionals: Array<{
    name: string;
    count: number;
  }>;
}
