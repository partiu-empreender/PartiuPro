'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function Navbar() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🎁</span>
          <span className="font-bold">Raio-X</span>
        </Link>

        <div className="hidden gap-8 md:flex">
          <Link href="#features" className="text-sm hover:text-primary">
            Funcionalidades
          </Link>
          <Link href="#pricing" className="text-sm hover:text-primary">
            Preços
          </Link>
          <Link href="/docs" className="text-sm hover:text-primary">
            Docs
          </Link>
        </div>

        <div className="flex gap-4">
          <Link href="/auth/login">
            <Button variant="ghost" size="sm">
              Login
            </Button>
          </Link>
          <Link href="/auth/signup">
            <Button size="sm">Comece agora</Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
