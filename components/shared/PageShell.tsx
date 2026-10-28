import { cn } from '@/lib/utils';

// Fonte única de largura e respiro de página. Toda tela do app passa por
// aqui — se o espaçamento precisar mudar, muda só neste arquivo.
// A barra do topo (logo e menu) fica no AppShell e usa as mesmas larguras,
// pra que a logo alinhe com a borda do conteúdo.

export const LARGURAS = {
  wide: 'max-w-7xl',
  narrow: 'max-w-2xl',
} as const;

export const SHELL_X = 'mx-auto w-full px-4 sm:px-6 lg:px-8';

interface PageShellProps {
  children: React.ReactNode;
  width?: keyof typeof LARGURAS;
  className?: string;
}

export default function PageShell({ children, width = 'wide', className }: PageShellProps) {
  // A logo que ficava centralizada no alto de cada página saiu: agora ela
  // está na barra do topo, em todas as telas. As duas juntas repetiriam a
  // mesma marca a um palmo de distância.
  return (
    <main className={cn(SHELL_X, LARGURAS[width], 'space-y-6 pb-12 pt-6 lg:pt-8', className)}>
      {children}
    </main>
  );
}
