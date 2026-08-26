'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { LogOut } from 'lucide-react';

interface NavbarProps {
  nome: string;
  isAdmin: boolean;
}

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/produtos', label: 'Produtos' },
  { href: '/dashboard/atendimentos', label: 'Atendimentos' },
  { href: '/dashboard/metas', label: 'Metas' },
  { href: '/dashboard/perfil', label: 'Perfil' },
  { href: '/dashboard/privacidade', label: 'Privacidade' },
];

export default function Navbar({ nome, isAdmin }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const links = isAdmin ? [...LINKS, { href: '/admin', label: 'Admin' }] : LINKS;

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
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">Olá, {nome}</span>
          <button
            type="button"
            onClick={sair}
            className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </div>
    </nav>
  );
}
