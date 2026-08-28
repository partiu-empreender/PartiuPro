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
import { garantirDono, limparMemoria } from '@/lib/cache-memoria';

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
        className={cn('shrink-0 rounded-full object-cover ring-2 ring-white/25', classes)}
      />
    ) : (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground ring-2 ring-white/25',
          classes,
        )}
      >
        {inicial}
      </span>
    );

  /**
   * `estreito` liga o modo recolhido: o menu fica só com os ícones e uma
   * miniatura da foto, e abre quando o mouse entra — ou quando o foco do
   * teclado entra, senão quem navega por Tab nunca leria os rótulos.
   *
   * A gaveta do celular passa `false`: lá o menu já é sob demanda, recolher
   * de novo não faria sentido.
   */
  const menu = (estreito: boolean) => {
    const soAoAbrir = estreito ? 'hidden group-hover:block group-focus-within:block' : 'block';
    const soAoAbrirInline = estreito
      ? 'hidden group-hover:inline group-focus-within:inline'
      : 'inline';
    const soAoFechar = estreito ? 'inline group-hover:hidden group-focus-within:hidden' : 'hidden';

    return (
      // Sem padding à direita de propósito: é isso que deixa o item ativo
      // encostar na borda do menu, como uma aba que se conecta ao conteúdo.
      <div className="flex h-full flex-col gap-5 overflow-y-auto overflow-x-hidden py-5 pl-4">
        <Link
          href="/dashboard"
          className="flex h-9 shrink-0 items-center justify-center pr-4"
          aria-label="Partiu PRO"
        >
          <span aria-hidden className="marca marca-clara whitespace-nowrap text-lg leading-none">
            <span className={soAoFechar}>PP</span>
            <span className={soAoAbrirInline}>Partiu PRO</span>
          </span>
        </Link>

        {/* Identidade. Recolhido: só a miniatura. Aberto: foto grande, nome e e-mail.

            A ALTURA E FIXA de propósito. Recolhido o bloco media ~56px e aberto
            ~144, e essa diferença empurrava todos os itens pra baixo quando o
            menu abria — a pessoa mirava num item e ele fugia. Agora o espaço é
            sempre o mesmo; só o conteúdo dentro dele muda. */}
        <div className="flex h-36 shrink-0 items-center justify-center pr-4">
          <Link
            href="/dashboard/perfil"
            title="Abrir meu perfil"
            className={cn(
              'flex w-full flex-col items-center justify-center gap-3 rounded-2xl bg-white/10 text-center transition-all duration-300 hover:bg-white/20',
              estreito ? 'p-1 group-hover:p-4 group-focus-within:p-4' : 'p-4',
            )}
          >
            {avatar(
              estreito
                ? 'h-10 w-10 text-sm transition-all duration-300 group-hover:h-16 group-hover:w-16 group-hover:text-xl group-focus-within:h-16 group-focus-within:w-16 group-focus-within:text-xl'
                : 'h-16 w-16 text-xl',
            )}
            <div className={cn('min-w-0 max-w-full', soAoAbrir)}>
              <p className="truncate text-sm font-semibold text-sidebar-foreground">{nome}</p>
              {email && <p className="truncate text-xs text-sidebar-muted">{email}</p>}
            </div>
          </Link>
        </div>

        {/* gap-2 dá espaço pros cantos invertidos do item ativo — com gap
            menor eles avançariam demais sobre a linha vizinha. */}
        <nav className="flex flex-1 flex-col gap-2">
          {links.map((link) => {
            const Icone = link.icon;
            const ativo = estaAtivo(rotaAtual, link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={ativo ? 'page' : undefined}
                title={link.label}
                onClick={() => setDestinoDoClique(link.href)}
                className={cn(
                  // h-11 fixo: sem o rótulo a linha teria 42px e com ele 44px,
                  // e esses 2px por item somavam uma dezena no menu inteiro.
                  'relative flex h-11 shrink-0 items-center gap-3 px-4 text-sm font-medium',
                  ativo
                    ? // Arredondado só à esquerda: à direita ele encosta reto na
                      // borda do painel, e a virada pra fora fica por conta dos
                      // cantos invertidos abaixo. Sem sombra — ele não flutua
                      // sobre o painel, ele é o fundo da página entrando nele.
                      //
                      // Sem transição aqui, de propósito: os cantos são pintados
                      // com gradiente, que não acompanha transition-colors. Com
                      // transição, o fundo entrava em fade e os cantos apareciam
                      // de uma vez — a aba se montava em dois tempos.
                      'rounded-l-2xl bg-background text-primary'
                    : // Os inativos ficam recuados e totalmente arredondados,
                      // então o realce de hover não se confunde com a aba ativa.
                      'mr-4 rounded-2xl text-sidebar-muted transition-colors hover:bg-white/10 hover:text-sidebar-foreground',
                )}
              >
                {ativo && (
                  <>
                    <span
                      aria-hidden
                      className="canto-pra-fora-cima pointer-events-none absolute bottom-full right-0 h-4 w-4"
                    />
                    <span
                      aria-hidden
                      className="canto-pra-fora-baixo pointer-events-none absolute top-full right-0 h-4 w-4"
                    />
                  </>
                )}
                <Icone className="h-[18px] w-[18px] shrink-0" />
                <span className={cn('whitespace-nowrap', soAoAbrirInline)}>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mr-4 flex flex-col gap-1 border-t border-white/10 pt-4">
          <Link
            href="/dashboard/perfil"
            title="Perfil"
            className="flex h-10 items-center gap-3 overflow-hidden rounded-xl px-4 text-sm font-medium text-sidebar-muted transition-colors hover:bg-white/10 hover:text-sidebar-foreground"
          >
            <User className="h-[18px] w-[18px] shrink-0" />
            <span className={cn('whitespace-nowrap', soAoAbrirInline)}>Perfil</span>
          </Link>
          <button
            type="button"
            onClick={sair}
            title="Sair"
            className="flex h-10 items-center gap-3 overflow-hidden rounded-xl px-4 text-left text-sm font-medium text-sidebar-muted transition-colors hover:bg-white/10 hover:text-sidebar-foreground"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            <span className={cn('whitespace-nowrap', soAoAbrirInline)}>Sair</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <Fundo />

      {/* No computador: recolhido, abrindo no hover. Ele cresce POR CIMA do
          conteúdo em vez de empurrá-lo — se empurrasse, a página inteira
          pularia toda vez que o mouse passasse perto.

          Quem detecta o mouse é esta faixa invisível, que começa na borda da
          tela; o painel fica recuado dentro dela. Antes o gatilho era o painel
          em si, então existia um vão morto de 16px na lateral: vindo da borda,
          a pessoa atravessava esse vão sem nada acontecer. */}
      <div className="group fixed inset-y-4 left-0 z-40 hidden w-24 transition-[width] duration-300 ease-out hover:w-[17rem] focus-within:w-[17rem] lg:block">
        <aside className="vidro-escuro absolute inset-y-0 left-4 right-0 rounded-3xl border-y border-l shadow-lift">
          {menu(true)}
        </aside>
      </div>

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
          {menu(false)}
        </div>
      </div>

      {/* O respiro à esquerda acompanha o menu RECOLHIDO (1rem + 5rem + 1rem).
          Como ele abre por cima, o conteúdo nunca se move. */}
      <div className="lg:pl-28">
        <header className="vidro sticky top-0 z-30 flex items-center justify-between gap-3 rounded-none border-x-0 border-t-0 px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            aria-label="Abrir menu"
            className="rounded-xl p-2 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span aria-hidden className="marca text-base leading-none">
            Partiu PRO
          </span>
          <Link href="/dashboard/perfil" aria-label={'Perfil de ' + primeiroNome}>
            {avatar('h-9 w-9 text-sm')}
          </Link>
        </header>

        {children}
      </div>
    </div>
  );
}
