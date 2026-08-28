import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Junta classes RESOLVENDO conflito entre elas.
 *
 * Antes era só clsx, e isso escondia um bug de verdade: como o Tailwind emite
 * `pt-0` depois de `p-8` no CSS, o `pt-0` da base do CardContent vencia o
 * `p-8` que o card pedia — e todo cartão com padding próprio ficava com o
 * conteúdo colado no topo. Nenhuma classe estava errada; ganhava a que vinha
 * por último no arquivo.
 *
 * Com o twMerge, a última classe PASSADA vence, que é o que quem escreve o
 * componente espera.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency: string = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value);
}

export function formatDate(date: string | Date, formatStr: string = 'dd/MM/yyyy'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, formatStr, { locale: ptBR });
}

export function formatDateTime(date: string | Date, formatStr: string = 'dd/MM/yyyy HH:mm'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, formatStr, { locale: ptBR });
}

export function formatDateForInput(date: string | Date): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'yyyy-MM-dd');
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateSlug(name: string): string {
  const baseSlug = slugify(name);
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${baseSlug}-${randomSuffix}`;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhoneNumber(phone: string): boolean {
  const cleanPhone = phone.replace(/\D/g, '');
  return cleanPhone.length >= 10;
}

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }

  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }

  return phone;
}

export function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = parseISO(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

export function isBirthdayToday(birthDate: string): boolean {
  const today = new Date();
  const birth = parseISO(birthDate);
  return today.getMonth() === birth.getMonth() && today.getDate() === birth.getDate();
}

export function isUpcoming(dateStr: string, daysAhead: number = 7): boolean {
  const date = parseISO(dateStr);
  const today = new Date();
  const futureDate = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  return date >= today && date <= futureDate;
}

export function calculateDeliveryDays(startDate: string, endDate: string): number {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function getDeliveryPeriodLabel(period: 'morning' | 'afternoon' | 'evening'): string {
  const labels = {
    morning: '🌅 Manhã (9h - 12h)',
    afternoon: '☀️ Tarde (14h - 18h)',
    evening: '🌙 Noite (18h - 21h)',
  };
  return labels[period];
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${timestamp}${random}`;
}

export function calculateAverageOrderValue(totalRevenue: number, totalOrders: number): number {
  if (totalOrders === 0) return 0;
  return Math.round((totalRevenue / totalOrders) * 100) / 100;
}

export function calculateConversionRate(sales: number, visitors: number): number {
  if (visitors === 0) return 0;
  return Math.round((sales / visitors) * 10000) / 100;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join('');
}
