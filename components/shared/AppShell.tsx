'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BellRing,
  CalendarRange,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ShieldCheck,
  Target,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import Fundo from '@/components/shared/Fundo';
import LogoPartiu from '@/components/shared/LogoPartiu';
import Sininho from '@/components/shared/Sininho';
import { LARGURAS, SHELL_X } from '@/components/shared/PageShell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { garantirDono, limparMemoria } from '@/lib/cache-memoria';

interface AppShellProps {
  nome: string;
  email?: string;
  avatarUrl?: string | null;
  isAdmin: boolean;
  children: React.ReactNode;
}

export interface Conta {
  nome: string;
  primeiroNome: string;
  email?: string;
  avatarUrl?: string | null;
  isAdmin: boolean;
}

// Quem está logada, pra qualquer tela dentro do AppShell. A home precisa do
// nome (saudação) e da foto (cartão grande); sem isto, cada tela teria que
// buscar o perfil de novo só pra saber o que o layout já sabe.
const ContaContext = createContext<Conta | null>(null);

export function usarConta(): Conta | null {
  return useContext(ContaContext);
}

const LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/clientes', label: 'Clientes', icon: Users },
  { href: '/dashboard/lembretes', label: 'Lembretes', icon: BellRing },
  { href: '/dashboard/produtos', label: 'Catálogo', icon: Package },
  { href: '/dashboard/atendimentos', label: 'Atendimentos', icon: HeartHandshake },
  { href: '/dashboard/metas', label: 'Metas', icon: Target },
  { href: '/dashboard/financeiro', label: 'Financeiro', icon: Wallet },
  { href: '/dashboard/historico', label: 'Histórico', icon: CalendarRange },
];

const LINK_ADMIN = { href: '/admin', label: 'Admin', icon: ShieldCheck };

// O Dashboard casa exato porque toda tela do app começa com /dashboard — se
// casasse por prefixo, ele ficaria aceso o tempo todo. Os demais casam por
// prefixo, pra que o detalhe de uma cliente mantenha "Clientes" aceso.
function estaAtivo(pathname: string, href: string): boolean {
  return href === '/dashboard' ? pathname === href : pathname.startsWith(href);
}

export default function AppShell({ nome, email, avatarUrl, isAdmin, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuAberto, setMenuAberto] = useState(false);

  // O usePathname() só muda quando a navegação TERMINA. Até lá o realce ficava
  // parado no item antigo, e o menu parecia correr atrás da página em vez de
  // já estar definido. Aqui o clique diz pra onde vai, e o realce se move na
  // hora; quando a rota chega de verdade, o palpite deixa de ser necessário.
  const [destinoDoClique, setDestinoDoClique] = useState<string | null>(null);
  const rotaAtual = destinoDoClique ?? pathname;

  // Roda no corpo do componente de propósito: o AppShell renderiza antes das
  // telas, então o cache de outra conta é descartado antes de qualquer tela
  // conseguir lê-lo. Num efeito seria tarde demais.
  garantirDono(email);

  const links = isAdmin ? [...LINKS, LINK_ADMIN] : LINKS;
  const primeiroNome = nome.trim().split(' ')[0] || nome;
  const inicial = nome.trim().charAt(0).toUpperCase() || '?';

  // Navegou: fecha a gaveta. Sem isto, tocar num link no celular abriria a
  // tela nova com o menu ainda por cima dela.
  useEffect(() => {
    setMenuAberto(false);
    setDestinoDoClique(null);
  }, [pathname]);

  // Esc fecha, e a página atrás não rola enquanto a gaveta está aberta.
  useEffect(() => {
    if (!menuAberto) return;

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setMenuAberto(false);
    };

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', aoTeclar);

    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [menuAberto]);

  const sair = async () => {
    // Sair e entrar com outra conta é navegação de SPA: sem limpar, a segunda
    // pessoa veria por um instante os dados da primeira.
    limparMemoria();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const avatar = (classes: string) =>
    avatarUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className={cn('shrink-0 rounded-full object-cover ring-2 ring-white', classes)}
      />
    ) : (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground ring-2 ring-white',
          classes,
        )}
      >
        {inicial}
      </span>
    );

  return (
    <ContaContext.Provider value={{ nome, primeiroNome, email, avatarUrl, isAdmin }}>
      <div className="min-h-screen">
        <Fundo />

        {/* O menu mora no topo, como na referência de out/2026: a logo grande
            encostada à esquerda e, encostados à direita, as abas numa pílula,
            o sininho e a foto. Sem barra por trás — cada peça flutua sozinha
            sobre o fundo.

            As abas aparecem a partir de `xl`: são nove, e abaixo disso elas
            não cabem sem espremer o texto. Até lá, o botão de menu abre a
            gaveta com a lista completa. */}
        <header className={cn(SHELL_X, LARGURAS.wide, 'flex items-center gap-2 pb-2 pt-5 sm:gap-3 sm:pt-6')}>
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            aria-label="Abrir menu"
            className="vidro flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-white xl:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link
            href="/dashboard"
            aria-label="Partiu Empreender — início"
            className="min-w-0 shrink"
            onClick={() => setDestinoDoClique('/dashboard')}
          >
            {/* No claro a logo usa o roxo da marca, herdado por currentColor. */}
            <LogoPartiu className="w-40 text-primary sm:w-56 xl:w-60" />
          </Link>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-2.5">
            <nav
              aria-label="Menu principal"
              className="vidro hidden items-center gap-0.5 rounded-full p-1.5 xl:flex"
            >
              {links.map((link) => {
                const ativo = estaAtivo(rotaAtual, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={ativo ? 'page' : undefined}
                    onClick={() => setDestinoDoClique(link.href)}
                    className={cn(
                      'whitespace-nowrap rounded-full px-3.5 py-2.5 text-[13px] font-medium transition-colors',
                      ativo
                        ? 'bg-sidebar text-sidebar-foreground shadow-soft'
                        : 'text-foreground/75 hover:bg-white hover:text-foreground',
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <Sininho className="h-11 w-11 sm:h-12 sm:w-12" />

            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={'Conta de ' + primeiroNome}
                className="vidro flex h-11 w-11 items-center justify-center rounded-full p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-12 sm:w-12"
              >
                {avatar('h-full w-full text-sm ring-0')}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white">
                <div className="px-2.5 py-2">
                  <p className="truncate text-sm font-semibold">{nome}</p>
                  {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/perfil" className="flex items-center gap-2">
                    <User className="h-4 w-4" /> Meu perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={sair} className="flex items-center gap-2">
                  <LogOut className="h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Abaixo de `xl`, a lista completa numa gaveta. */}
        <div
          className={cn(
            'fixed inset-0 z-50 transition-[visibility] duration-300 xl:hidden',
            menuAberto ? 'visible' : 'invisible',
          )}
        >
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMenuAberto(false)}
            className={cn(
              'absolute inset-0 bg-sidebar/40 backdrop-blur-sm transition-opacity duration-300',
              menuAberto ? 'opacity-100' : 'opacity-0',
            )}
          />
          <div
            role="dialog"
            aria-modal={menuAberto}
            aria-label="Menu"
            className={cn(
              'vidro-escuro absolute inset-y-3 left-3 w-[17rem] max-w-[85vw] rounded-3xl border shadow-lift transition-transform duration-300 ease-out',
              menuAberto ? 'translate-x-0' : '-translate-x-[calc(100%+1rem)]',
            )}
          >
            <button
              type="button"
              onClick={() => setMenuAberto(false)}
              aria-label="Fechar menu"
              className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-sidebar-muted transition-colors hover:bg-white/10 hover:text-sidebar-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex h-full flex-col gap-5 overflow-y-auto p-4 pt-5">
              <div className="pr-10">
                <LogoPartiu className="w-40 text-[hsl(264_80%_88%)]" />
              </div>

              <Link
                href="/dashboard/perfil"
                className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 transition-colors hover:bg-white/20"
              >
                {avatar('h-12 w-12 text-lg ring-white/25')}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-sidebar-foreground">{nome}</p>
                  {email && <p className="truncate text-xs text-sidebar-muted">{email}</p>}
                </div>
              </Link>

              <nav aria-label="Menu" className="flex flex-1 flex-col gap-1">
                {links.map((link) => {
                  const Icone = link.icon;
                  const ativo = estaAtivo(rotaAtual, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={ativo ? 'page' : undefined}
                      onClick={() => setDestinoDoClique(link.href)}
                      className={cn(
                        'flex h-11 shrink-0 items-center gap-3 rounded-2xl px-4 text-sm font-medium transition-colors',
                        ativo
                          ? 'bg-background text-primary'
                          : 'text-sidebar-muted hover:bg-white/10 hover:text-sidebar-foreground',
                      )}
                    >
                      <Icone className="h-[18px] w-[18px] shrink-0" />
                      {link.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="flex flex-col gap-1 border-t border-white/10 pt-4">
                <Link
                  href="/dashboard/perfil"
                  className="flex h-10 items-center gap-3 rounded-xl px-4 text-sm font-medium text-sidebar-muted transition-colors hover:bg-white/10 hover:text-sidebar-foreground"
                >
                  <User className="h-[18px] w-[18px] shrink-0" />
                  Perfil
                </Link>
                <button
                  type="button"
                  onClick={sair}
                  className="flex h-10 items-center gap-3 rounded-xl px-4 text-left text-sm font-medium text-sidebar-muted transition-colors hover:bg-white/10 hover:text-sidebar-foreground"
                >
                  <LogOut className="h-[18px] w-[18px] shrink-0" />
                  Sair
                </button>
              </div>
            </div>
          </div>
        </div>

        {children}
      </div>
    </ContaContext.Provider>
  );
}
