import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Peças comuns dos cartões da home.

export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** "R$ 2,3 mil", pra eixo de gráfico e lugar apertado. */
export function brlCurto(n: number): string {
  if (Math.abs(n) >= 1000) {
    return `R$ ${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  }
  return `R$ ${Math.round(n).toLocaleString('pt-BR')}`;
}

export const dataCurta = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');

interface CartaoProps {
  titulo?: React.ReactNode;
  /** O que fica no canto direito do título: um link, um número. */
  canto?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** A moldura de vidro de todo cartão da home. */
export function Cartao({ titulo, canto, className, children }: CartaoProps) {
  return (
    <section className={cn('vidro flex min-w-0 flex-col rounded-[1.75rem] p-5', className)}>
      {(titulo || canto) && (
        <div className="flex items-start justify-between gap-3">
          {titulo && <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>}
          {canto}
        </div>
      )}
      {children}
    </section>
  );
}

/** O botão redondo com a seta, que leva à tela completa daquele assunto. */
export function LinkSeta({ href, rotulo }: { href: string; rotulo: string }) {
  return (
    <Link
      href={href}
      aria-label={rotulo}
      title={rotulo}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-foreground shadow-soft transition-transform hover:-translate-y-0.5"
    >
      <ArrowUpRight className="h-4 w-4" />
    </Link>
  );
}

/** Cartão sem dado ainda: diz o que vai aparecer ali, em vez de um zero solto. */
export function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex flex-1 items-center justify-center px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
