import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CartaoIndicadorProps {
  titulo: string;
  valor: string;
  icone: LucideIcon;
  /** Classe de cor do ícone, ex.: 'text-emerald-600'. */
  cor?: string;
}

/**
 * Cartão de número único — faturamento, ticket médio, conversão.
 *
 * Antes cada um era montado à mão com CardHeader em `flex-row justify-between`
 * e o número no CardContent. Em seis colunas o cartão fica estreito demais pra
 * isso: o título quebrava em duas linhas, empurrava o ícone pra linha de baixo
 * e o número encostava na borda esquerda — cada cartão com uma altura.
 *
 * Aqui a ordem é vertical e tudo é centrado nos dois eixos, então os seis
 * ficam iguais independentemente do tamanho do texto.
 */
export default function CartaoIndicador({
  titulo,
  valor,
  icone: Icone,
  cor = 'text-primary',
}: CartaoIndicadorProps) {
  return (
    <Card className="flex flex-col items-center justify-center gap-2.5 p-5 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
        <Icone className={cn('h-5 w-5', cor)} />
      </span>
      <p className="text-xs font-medium leading-tight text-muted-foreground">{titulo}</p>
      <p className="text-2xl font-bold leading-none tracking-tight">{valor}</p>
    </Card>
  );
}
