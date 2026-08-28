import type { Metadata } from 'next';
import { Cinzel, Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

// Fonte da marca: serifada romana, desenhada pra caixa alta — por isso ela
// aguenta o "PARTIU PRO" todo em maiúsculas sem ficar pesada.
const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--fonte-marca',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Partiu PRO',
  description: 'Sistema de vendas inteligente',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={cinzel.variable}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
