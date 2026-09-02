'use client';

import { useRouter } from 'next/navigation';
import { Clock, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import IconeWhatsApp from '@/components/shared/IconeWhatsApp';
import { linkWhatsAppCom } from '@/lib/telefone';
import { cn } from '@/lib/utils';
import {
  ROTULO_ORIGEM,
  comoFalarDaData,
  mensagemSugerida,
  type Lembrete,
} from '@/lib/lembretes';

/**
 * Uma linha da agenda.
 *
 * O botão do WhatsApp já vai com a primeira frase escrita. Foi a decisão mais
 * importante desta tela: um lembrete que só diz "é o aniversário da Fulana"
 * transfere pra aluna o trabalho de abrir o aplicativo, achar o contato e
 * pensar no que dizer — e é aí que o contato deixa de acontecer. A frase é um
 * rascunho: o WhatsApp abre com ela preenchida e ela edita antes de mandar.
 *
 * A linha INTEIRA é clicável. Antes só o título era, e ninguém adivinha que
 * aquele texto específico é o único ponto vivo de um cartão que parece
 * clicável por completo.
 */

/**
 * Adiar existe por causa do lembrete que ela vê mas não pode resolver agora —
 * "hoje não dá, ligo sábado". Sem isso, as opções eram marcar como feito sem
 * ter feito (e perder o contato) ou deixar acumular como atrasado (e treinar o
 * olho a ignorar a tarja vermelha).
 */
const ADIAMENTOS = [
  { dias: 1, rotulo: 'Adiar 1 dia' },
  { dias: 3, rotulo: 'Adiar 3 dias' },
  { dias: 7, rotulo: 'Adiar 1 semana' },
];

/**
 * A caixa dos botões de ação.
 *
 * Todos com o mesmo tamanho e com fundo permanente, não só no hover. Com fundo
 * apenas no hover, o botão verde do WhatsApp aparecia colorido e o cinza ao
 * lado sumia — pareciam dois componentes diferentes, ou um deles quebrado.
 */
const BOTAO_DE_ACAO =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors sm:h-9 sm:w-9';

export default function ItemLembrete({
  lembrete,
  hoje,
  onConcluir,
  onAdiar,
  onAbrir,
  onRemover,
}: {
  lembrete: Lembrete;
  hoje: string;
  onConcluir: (lembrete: Lembrete, feito: boolean) => void;
  onAdiar?: (lembrete: Lembrete, dias: number) => void;
  /** Abre o detalhe do lembrete. Quando existe, tem preferência sobre ir pra ficha. */
  onAbrir?: (lembrete: Lembrete) => void;
  onRemover?: (lembrete: Lembrete) => void;
}) {
  const router = useRouter();

  const atrasado = !lembrete.concluido && lembrete.data < hoje;
  const eHoje = !lembrete.concluido && lembrete.data === hoje;

  const whatsapp = linkWhatsAppCom(lembrete.cliente_telefone, mensagemSugerida(lembrete));

  // Só o que a aluna escreveu pode ser apagado. Um automático se resolve pelo
  // check — apagar não faria sentido, ele voltaria a ser calculado amanhã.
  const podeApagar = onRemover && lembrete.gravado && lembrete.origem === 'manual';

  /**
   * O que o clique na linha faz.
   *
   * Quem passa `onAbrir` quer o detalhe — é o caso da ficha da cliente, onde
   * navegar pra ela de novo não levaria a lugar nenhum. Sem `onAbrir`, o
   * clique vai pra ficha de quem o lembrete é sobre, que é o destino útil a
   * partir da agenda. Um lembrete solto, sem cliente, não tem para onde ir.
   */
  const abrir = onAbrir
    ? () => onAbrir(lembrete)
    : lembrete.customer_id
      ? () => router.push(`/dashboard/clientes/${lembrete.customer_id}`)
      : undefined;

  return (
    <div
      onClick={abrir}
      className={cn(
        'flex items-start gap-3 rounded-2xl border p-3 transition-colors',
        abrir && 'cursor-pointer',
        lembrete.concluido
          ? 'border-input bg-white/40 opacity-60'
          : atrasado
            ? 'border-red-200 bg-red-50/60 hover:bg-red-50'
            : eHoje
              ? 'border-amber-200 bg-amber-50/60 hover:bg-amber-50'
              : 'border-input bg-white/60 hover:bg-white/90',
      )}
    >
      {/* O clique na caixinha para aqui: se subisse pra linha, marcar como
          feito também abriria o detalhe. */}
      <span onClick={(e) => e.stopPropagation()} className="mt-0.5">
        <Checkbox
          checked={lembrete.concluido}
          onCheckedChange={(marcado) => onConcluir(lembrete, marcado === true)}
          aria-label={lembrete.concluido ? 'Marcar como não feito' : 'Marcar como feito'}
        />
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        {/* Um botão de verdade além da linha clicável: a linha resolve o mouse,
            o botão resolve o teclado e o leitor de tela. O stopPropagation
            impede que o clique conte duas vezes. */}
        {abrir ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              abrir();
            }}
            className={cn(
              'block text-left text-sm font-medium hover:underline',
              lembrete.concluido && 'line-through',
            )}
          >
            {lembrete.titulo}
          </button>
        ) : (
          <p className={cn('text-sm font-medium', lembrete.concluido && 'line-through')}>
            {lembrete.titulo}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span
            className={cn(
              'font-medium',
              atrasado ? 'text-red-700' : eHoje ? 'text-amber-700' : 'text-muted-foreground',
            )}
          >
            {comoFalarDaData(lembrete.data, hoje)}
          </span>
          <span className="text-muted-foreground">·</span>
          {/* O `??` cobre uma linha antiga cujo `origem` este código não
              conheça: sem ele o rótulo sairia vazio e o "·" ficaria solto. */}
          <span className="text-muted-foreground">
            {ROTULO_ORIGEM[lembrete.origem] ?? ROTULO_ORIGEM.manual}
          </span>
        </div>

        {lembrete.observacao && !lembrete.concluido && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{lembrete.observacao}</p>
        )}
      </div>

      {/* Nenhum botão daqui pode disparar o clique da linha. */}
      <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {whatsapp && !lembrete.concluido && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            title={`Falar com ${lembrete.cliente_nome ?? 'a cliente'} no WhatsApp`}
            className={cn(
              BOTAO_DE_ACAO,
              'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
            )}
          >
            <IconeWhatsApp className="h-4 w-4" />
            <span className="sr-only">Falar no WhatsApp</span>
          </a>
        )}

        {onAdiar && !lembrete.concluido && (
          <DropdownMenu>
            <DropdownMenuTrigger
              title="Adiar"
              className={cn(
                BOTAO_DE_ACAO,
                'border-input bg-white/70 text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Clock className="h-4 w-4" />
              <span className="sr-only">Adiar lembrete</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {ADIAMENTOS.map((opcao) => (
                <DropdownMenuItem key={opcao.dias} onClick={() => onAdiar(lembrete, opcao.dias)}>
                  {opcao.rotulo}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {podeApagar && (
          <button
            type="button"
            onClick={() => onRemover?.(lembrete)}
            title="Apagar lembrete"
            className={cn(
              BOTAO_DE_ACAO,
              'border-input bg-white/70 text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
            )}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Apagar lembrete</span>
          </button>
        )}
      </div>
    </div>
  );
}
