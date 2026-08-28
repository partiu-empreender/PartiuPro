'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ShieldCheck,
  Target,
  User,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import Fundo from '@/components/shared/Fundo';

interface AppShellProps {
  nome: string;
  email?: string;
  avatarUrl?: string | null;
  isAdmin: boolean;
  children: React.ReactNode;
}

const LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/clientes', label: 'Clientes', icon: Users },
  { href: '/dashboard/produtos', label: 'Catálogo', icon: Package },
  { href: '/dashboard/atendimentos', label: 'Atendimentos', icon: HeartHandshake },
  { href: '/dashboard/metas', label: 'Metas', icon: Target },
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

  const links = isAdmin ? [...LINKS, LINK_ADMIN] : LINKS;
  const primeiroNome = nome.trim().split(' ')[0] || nome;
  const inicial = nome.trim().charAt(0).toUpperCase() || '?';

  // Navegou: fecha a gaveta. Sem isto, tocar num link no celular abriria a
  // tela nova com o menu ainda por cima dela.
  useEffect(() => {
    setMenuAberto(false);
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
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const avatar = (tamanho: string, textoTamanho: string) =>
    avatarUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className={cn('shrink-0 rounded-full object-cover ring-2 ring-white/25', tamanho)}
      />
    ) : (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground ring-2 ring-white/25',
          tamanho,
          textoTamanho,
        )}
      >
        {inicial}
      </span>
    );

  const menu = (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-5">
      <Link href="/dashboard" className="flex items-center gap-2 px-2 text-sidebar-foreground">
        <span aria-hidden className="text-2xl leading-none">
          🎁
        </span>
        <span className="text-lg font-bold tracking-tight">Partiu PRO</span>
      </Link>

      {/* Bloco de identidade: a foto grande, como na referência. */}
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/10 p-5 text-center">
        {avatar('h-20 w-20', 'text-2xl')}
        <div className="min-w-0 max-w-full">
          <p className="truncate text-sm font-semibold text-sidebar-foreground">{nome}</p>
          {email && <p className="truncate text-xs text-sidebar-muted">{email}</p>}
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {links.map((link) => {
          const Icone = link.icon;
          const ativo = estaAtivo(pathname, link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={ativo ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                ativo
                  ? 'bg-white/95 text-primary shadow-soft'
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
          className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-sidebar-muted transition-colors hover:bg-white/10 hover:text-sidebar-foreground"
        >
          <User className="h-[18px] w-[18px] shrink-0" />
          Perfil
        </Link>
        <button
          type="button"
          onClick={sair}
          className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-medium text-sidebar-muted transition-colors hover:bg-white/10 hover:text-sidebar-foreground"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <Fundo />

      {/* No computador o menu é um painel flutuante, com folga nas bordas. */}
      <aside className="vidro-escuro fixed inset-y-4 left-4 z-40 hidden w-64 rounded-3xl border shadow-lift lg:block">
        {menu}
      </aside>

      {/* No celular vira gaveta. */}
      <div
        className={cn(
          'fixed inset-0 z-50 transition-[visibility] duration-300 lg:hidden',
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
          {menu}
        </div>
      </div>

      <div className="lg:pl-72">
        {/* Barra de topo só no celular. No computador o menu lateral já dá a
            identidade e o contexto, e uma barra a mais só roubaria altura. */}
        <header className="vidro sticky top-0 z-30 flex items-center justify-between gap-3 rounded-none border-x-0 border-t-0 px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            aria-label="Abrir menu"
            className="rounded-xl p-2 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="flex items-center gap-2 text-sm font-bold tracking-tight">
            <span aria-hidden>🎁</span> Partiu PRO
          </span>
          <Link href="/dashboard/perfil" aria-label={'Perfil de ' + primeiroNome}>
            {avatar('h-9 w-9', 'text-sm')}
          </Link>
        </header>

        {children}
      </div>
    </div>
  );
}
