'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Trash2 } from 'lucide-react';
import IconeWhatsApp from '@/components/shared/IconeWhatsApp';
import { linkWhatsAppCom } from '@/lib/telefone';
import {
  ROTULO_ORIGEM,
  comoFalarDaData,
  formatarBR,
  mensagemSugerida,
  type Lembrete,
} from '@/lib/lembretes';

/**
 * O lembrete por inteiro.
 *
 * A linha da agenda mostra o essencial e corta a observação em duas linhas —
 * o que é certo numa lista, mas some justamente o que a aluna escreveu quando
 * criou o lembrete ("ela pediu pra confirmar o sabor uma semana antes"). Este
 * diálogo é onde esse texto aparece completo, junto das ações.
 *
 * Não edita: por enquanto o que dá pra mudar é a data (adiar) e o estado
 * (feito ou não). Editar o texto é a próxima peça óbvia e cabe aqui dentro
 * sem mudar nada em volta.
 */
export default function DetalheLembreteDialog({
  lembrete,
  hoje,
  onOpenChange,
  onConcluir,
  onAdiar,
  onRemover,
}: {
  /** `null` fecha o diálogo. */
  lembrete: Lembrete | null;
  hoje: string;
  onOpenChange: (aberto: boolean) => void;
  onConcluir: (lembrete: Lembrete, feito: boolean) => void;
  onAdiar?: (lembrete: Lembrete, dias: number) => void;
  onRemover?: (lembrete: Lembrete) => void;
}) {
  if (!lembrete) return null;

  const whatsapp = linkWhatsAppCom(lembrete.cliente_telefone, mensagemSugerida(lembrete));
  const podeApagar = onRemover && lembrete.gravado && lembrete.origem === 'manual';

  const linha = (rotulo: string, valor: React.ReactNode) => (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b py-2 last:border-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</span>
      <span className="text-sm font-medium">{valor}</span>
    </div>
  );

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6 text-left">{lembrete.titulo}</DialogTitle>
        </DialogHeader>

        <div className="space-y-1">
          {linha(
            'Quando',
            <>
              {formatarBR(lembrete.data)}{' '}
              <span className="text-muted-foreground">
                ({comoFalarDaData(lembrete.data, hoje).toLowerCase()})
              </span>
            </>,
          )}
          {linha('De onde veio', ROTULO_ORIGEM[lembrete.origem] ?? ROTULO_ORIGEM.manual)}
          {lembrete.cliente_nome &&
            linha(
              'Cliente',
              lembrete.customer_id ? (
                <Link
                  href={`/dashboard/clientes/${lembrete.customer_id}`}
                  className="text-primary hover:underline"
                >
                  {lembrete.cliente_nome}
                </Link>
              ) : (
                lembrete.cliente_nome
              ),
            )}
          {linha('Situação', lembrete.concluido ? 'Já resolvido' : 'Pendente')}
        </div>

        {lembrete.observacao ? (
          <div className="space-y-1 rounded-xl border bg-white/60 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Observação</p>
            <p className="whitespace-pre-wrap text-sm">{lembrete.observacao}</p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sem observação neste lembrete.</p>
        )}

        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="block">
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
              <IconeWhatsApp className="mr-2 h-4 w-4" />
              Falar com {(lembrete.cliente_nome ?? '').split(' ')[0] || 'a cliente'} no WhatsApp
            </Button>
          </a>
        )}

        {onAdiar && !lembrete.concluido && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Adiar para</p>
            <div className="flex flex-wrap gap-2">
              {[
                { dias: 1, rotulo: 'Amanhã' },
                { dias: 3, rotulo: 'Em 3 dias' },
                { dias: 7, rotulo: 'Em 1 semana' },
              ].map((opcao) => (
                <Button
                  key={opcao.dias}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onAdiar(lembrete, opcao.dias);
                    onOpenChange(false);
                  }}
                >
                  {opcao.rotulo}
                </Button>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          {podeApagar ? (
            <Button
              variant="ghost"
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                onRemover?.(lembrete);
                onOpenChange(false);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Apagar
            </Button>
          ) : (
            <span />
          )}
          <Button
            variant={lembrete.concluido ? 'outline' : 'default'}
            onClick={() => {
              onConcluir(lembrete, !lembrete.concluido);
              onOpenChange(false);
            }}
          >
            {lembrete.concluido ? 'Reabrir lembrete' : 'Marcar como feito'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
