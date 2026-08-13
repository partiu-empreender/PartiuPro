import axios from 'axios';

const WHATSAPP_API_URL = 'https://graph.instagram.com/v18.0';

interface WhatsAppMessagePayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text' | 'template';
  text?: {
    body: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: Array<{
      type: string;
      parameters?: Array<{
        type: string;
        text?: string;
      }>;
    }>;
  };
}

export async function sendWhatsAppMessage(phoneNumber: string, message: string) {
  try {
    const payload: WhatsAppMessagePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'text',
      text: {
        body: message,
      },
    };

    const response = await axios.post(
      `${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data;
  } catch (error) {
    console.error('WhatsApp API error:', error);
    throw error;
  }
}

export function formatOrderForWhatsApp(order: {
  id: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  subtotal: number;
  shipping_cost: number;
  total: number;
  delivery_date: string;
  delivery_period: string;
  customer_name: string;
}): string {
  const itemsList = order.items
    .map((item) => `• ${item.name} x${item.quantity} - R$ ${(item.price * item.quantity).toFixed(2)}`)
    .join('\n');

  return `🎁 *Seu Pedido #${order.id.slice(-8).toUpperCase()}*

${itemsList}

📊 *Resumo:*
Subtotal: R$ ${order.subtotal.toFixed(2)}
Frete: R$ ${order.shipping_cost.toFixed(2)}
*Total: R$ ${order.total.toFixed(2)}*

📅 *Entrega:*
Data: ${new Date(order.delivery_date).toLocaleDateString('pt-BR')}
Período: ${order.delivery_period === 'morning' ? '🌅 Manhã' : order.delivery_period === 'afternoon' ? '☀️ Tarde' : '🌙 Noite'}

👤 Cliente: ${order.customer_name}

Confirme seu pedido respondendo a esta mensagem!`;
}

export function createWhatsAppLink(phoneNumber: string, message: string): string {
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
}

export async function sendOrderConfirmationViaWhatsApp(
  customerPhone: string,
  order: {
    id: string;
    items: Array<{ name: string; quantity: number; price: number }>;
    subtotal: number;
    shipping_cost: number;
    total: number;
    delivery_date: string;
    delivery_period: string;
    customer_name: string;
  },
): Promise<void> {
  const message = formatOrderForWhatsApp(order);

  try {
    await sendWhatsAppMessage(customerPhone, message);
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error);
    throw new Error('Falha ao enviar mensagem via WhatsApp');
  }
}

export function validateWhatsAppPhoneNumber(phone: string): boolean {
  // Remove non-numeric characters
  const cleanPhone = phone.replace(/\D/g, '');
  // Must have at least 10 digits (Brazil standard)
  return cleanPhone.length >= 10;
}
