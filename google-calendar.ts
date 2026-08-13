import axios from 'axios';

interface CalendarEvent {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: string;
}

const CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3';

export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: CalendarEvent,
): Promise<any> {
  try {
    const response = await axios.post(
      `${CALENDAR_API_URL}/calendars/${encodeURIComponent(calendarId)}/events`,
      event,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data;
  } catch (error) {
    console.error('Calendar API error:', error);
    throw error;
  }
}

export async function listCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<any[]> {
  try {
    const response = await axios.get(
      `${CALENDAR_API_URL}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        params: {
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: 'startTime',
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    return response.data.items || [];
  } catch (error) {
    console.error('Calendar API error:', error);
    throw error;
  }
}

export async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: Partial<CalendarEvent>,
): Promise<any> {
  try {
    const response = await axios.patch(
      `${CALENDAR_API_URL}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      event,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data;
  } catch (error) {
    console.error('Calendar API error:', error);
    throw error;
  }
}

export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  try {
    await axios.delete(
      `${CALENDAR_API_URL}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
  } catch (error) {
    console.error('Calendar API error:', error);
    throw error;
  }
}

export function formatOrderAsCalendarEvent(order: {
  id: string;
  customer_name: string;
  delivery_date: string;
  delivery_period: string;
  total: number;
  items: Array<{ name: string; quantity: number }>;
}): CalendarEvent {
  const date = new Date(order.delivery_date);
  const hour = order.delivery_period === 'morning' ? 9 : order.delivery_period === 'afternoon' ? 14 : 18;

  const startTime = new Date(date);
  startTime.setHours(hour, 0, 0);

  const endTime = new Date(startTime);
  endTime.setHours(hour + 1);

  const itemsList = order.items.map((item) => `${item.name} (x${item.quantity})`).join(', ');

  return {
    summary: `Entrega - ${order.customer_name}`,
    description: `Pedido #${order.id}\nItens: ${itemsList}\nTotal: R$ ${order.total.toFixed(2)}`,
    start: {
      dateTime: startTime.toISOString(),
      timeZone: 'America/Sao_Paulo',
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: 'America/Sao_Paulo',
    },
    location: order.customer_name,
  };
}

export async function syncOrdersToCalendar(
  accessToken: string,
  calendarId: string,
  orders: Array<{
    id: string;
    customer_name: string;
    delivery_date: string;
    delivery_period: string;
    total: number;
    items: Array<{ name: string; quantity: number }>;
  }>,
): Promise<void> {
  try {
    for (const order of orders) {
      const event = formatOrderAsCalendarEvent(order);
      await createCalendarEvent(accessToken, calendarId, event);
    }
  } catch (error) {
    console.error('Calendar sync error:', error);
    throw error;
  }
}
