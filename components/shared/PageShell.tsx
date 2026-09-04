import { cn } from '@/lib/utils';
import LogoPartiu from '@/components/shared/LogoPartiu';

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
  /**
   * Esconde a logo do topo. Serve pra tela que já abre com uma marca própria
   * — hoje ninguém usa, mas existe pra não obrigar quem precisar a parar de
   * usar o PageShell (e perder largura e respiro junto).
   */
  semLogo?: boolean;
}

export default function PageShell({
  children,
  width = 'wide',
  className,
  semLogo = false,
}: PageShellProps) {
  return (
    <main className={cn(SHELL_X, LARGURAS[width], 'space-y-6 py-10 lg:py-12', className)}>
      {/*
        A logo, centralizada e no alto de toda página.

        Fica AQUI, e não em cada tela, porque toda tela já passa pelo
        PageShell: repetir o bloco em nove arquivos daria nove chances de as
        margens divergirem. E fica antes do `space-y-6` fazer efeito, então o
        respiro até o conteúdo é o mesmo de qualquer outro bloco da página.

        No celular ela não aparece — ver o porquê logo abaixo.
      */}
      {!semLogo && (
        // `hidden lg:flex`: no celular o cabeçalho fixo do AppShell já mostra a
        // logo, e as duas empilhadas gastavam uma faixa de tela pequena
        // repetindo a mesma informação. No desktop aquele cabeçalho não existe
        // (ele é `lg:hidden`), então aqui é o único lugar onde ela aparece
        // sobre o conteúdo. As telas de login/cadastro não usam PageShell e
        // têm a sua própria — ver app/(auth)/layout.tsx.
        <div className="hidden justify-center pb-2 lg:flex">
          <LogoPartiu className="w-56 text-primary" />
        </div>
      )}
      {children}
    </main>
  );
}
