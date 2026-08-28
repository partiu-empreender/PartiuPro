import { cn } from '@/lib/utils';

// Fonte única de largura e respiro de página. Toda tela do app passa por
// aqui — se o espaçamento precisar mudar, muda só neste arquivo.
// O deslocamento do menu lateral fica no AppShell; aqui é só o miolo.

export const LARGURAS = {
  wide: 'max-w-6xl',
  narrow: 'max-w-2xl',
} as const;

export const SHELL_X = 'mx-auto w-full px-4 sm:px-6 lg:px-8';

interface PageShellProps {
  children: React.ReactNode;
  width?: keyof typeof LARGURAS;
  className?: string;
}

export default function PageShell({ children, width = 'wide', className }: PageShellProps) {
  return (
    <main className={cn(SHELL_X, LARGURAS[width], 'space-y-6 py-10 lg:py-12', className)}>
      {children}
    </main>
  );
}
