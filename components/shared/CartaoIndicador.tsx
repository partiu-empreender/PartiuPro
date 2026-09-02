import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CartaoIndicadorProps {
  titulo: string;
  valor: string;
  icone: LucideIcon;
  /** Classe de cor do ícone, ex.: 'text-emerald-600'. */
  cor?: string;
  /**
   * Torna o cartão clicável. Só passe quando houver ação de verdade: cartão
   * que parece botão e não faz nada é pior que cartão parado.
   */
  onClick?: () => void;
  /** Chamada pra ação, aparece embaixo do número quando há onClick. */
  chamada?: string;
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
  onClick,
  chamada,
}: CartaoIndicadorProps) {
  const conteudo = (
    <>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
        <Icone className={cn('h-5 w-5', cor)} />
      </span>
      <p className="text-xs font-medium leading-tight text-muted-foreground">{titulo}</p>
      <p className="text-2xl font-bold leading-none tracking-tight">{valor}</p>
      {chamada && <p className="text-[11px] font-medium text-primary">{chamada}</p>}
    </>
  );

  const classes = 'flex flex-col items-center justify-center gap-2.5 px-5 py-7 text-center';

  // Botão de verdade quando é clicável — e não uma div com onClick. Assim o
  // cartão entra na navegação por teclado e o leitor de tela o anuncia como
  // acionável, de graça.
  //
  // Repete as classes visuais do Card em vez de usá-lo: Card é uma <div> sem
  // asChild, e aninhar um <button> dentro dele daria uma caixa clicável dentro
  // de outra caixa.
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'vidro rounded-2xl text-card-foreground transition-shadow duration-300 hover:shadow-glass',
          classes,
          'cursor-pointer hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        )}
      >
        {conteudo}
      </button>
    );
  }

  return <Card className={classes}>{conteudo}</Card>;
}
