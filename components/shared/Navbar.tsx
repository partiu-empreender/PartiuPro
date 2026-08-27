'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { LARGURAS, SHELL_X } from '@/components/shared/PageShell';

interface NavbarProps {
  nome: string;
  email?: string;
  avatarUrl?: string | null;
  isAdmin: boolean;
}

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/clientes', label: 'Clientes' },
  { href: '/dashboard/produtos', label: 'Produtos' },
  { href: '/dashboard/atendimentos', label: 'Atendimentos' },
  { href: '/dashboard/metas', label: 'Metas' },
];

export default function Navbar({ nome, email, avatarUrl, isAdmin }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const links = isAdmin ? [...LINKS, { href: '/admin', label: 'Admin' }] : LINKS;
  const primeiroNome = nome.trim().split(' ')[0] || nome;
  const inicial = nome.trim().charAt(0).toUpperCase() || '?';

  const avatar = (tamanho: string) =>
    avatarUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className={cn('shrink-0 rounded-full object-cover', tamanho)}
      />
    ) : (
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground',
          tamanho,
        )}
      >
        {inicial}
      </span>
    );

  const sair = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <nav className="border-b bg-card">
      <div className={cn(SHELL_X, LARGURAS.wide, 'flex items-center justify-between gap-4 py-3')}>
        {/* No celular a fileira rola na horizontal em vez de quebrar em duas linhas */}
        <div className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                pathname === link.href
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring">
            {avatar('h-8 w-8 text-xs')}
            <span className="hidden sm:inline">Olá, {primeiroNome}</span>
            <ChevronDown className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="flex items-center gap-3">
              {avatar('h-9 w-9 text-sm')}
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate">{nome}</span>
                {email && (
                  <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
                )}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/perfil">
                <User className="h-4 w-4" /> Perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={sair}>
              <LogOut className="h-4 w-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
