import type { Metadata } from 'next';
import { Inter, Oswald } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

// Fonte da marca: condensada, de hastes retas e verticais. Em caixa alta ela
// fica alta e estreita, que é o desenho de logotipo que a Tania pediu.
const oswald = Oswald({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--fonte-marca',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Partiu PRO',
  description: 'Sistema de vendas inteligente',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={oswald.variable}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
