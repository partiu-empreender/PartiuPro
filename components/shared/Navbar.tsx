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

interface NavbarProps {
  nome: string;
  email?: string;
  isAdmin: boolean;
}

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/produtos', label: 'Produtos' },
  { href: '/dashboard/atendimentos', label: 'Atendimentos' },
  { href: '/dashboard/metas', label: 'Metas' },
];

export default function Navbar({ nome, email, isAdmin }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const links = isAdmin ? [...LINKS, { href: '/admin', label: 'Admin' }] : LINKS;
  const primeiroNome = nome.trim().split(' ')[0] || nome;
  const inicial = nome.trim().charAt(0).toUpperCase() || '?';

  const sair = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <nav className="border-b bg-card">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-6 py-3">
        <div className="flex flex-wrap items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
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
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {inicial}
            </span>
            <span className="hidden sm:inline">Olá, {primeiroNome}</span>
            <ChevronDown className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="truncate">{nome}</span>
              {email && (
                <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
              )}
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
