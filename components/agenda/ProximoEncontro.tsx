'use client';

import { CalendarDays, Clock, Video } from 'lucide-react';
import { horaCurta, momentoDoEncontro, quandoEhOEncontro, type Encontro } from '@/lib/agenda';
import { cn } from '@/lib/utils';

const formatadorData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/**
 * O próximo encontro da mentoria, em destaque.
 *
 * O botão da sala só acende 15 minutos antes (ver momentoDoEncontro): antes
 * disso, um link clicável dias antes convida a entrar numa sala vazia.
 */
export default function ProximoEncontro({
  encontro,
  className,
  compacto = false,
}: {
  encontro: Encontro | null;
  className?: string;
  compacto?: boolean;
}) {
  if (!encontro) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3',
          className,
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <CalendarDays className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Próximo encontro</p>
          <p className="text-xs text-muted-foreground">Nenhum encontro marcado por enquanto.</p>
        </div>
      </div>
    );
  }

  const momento = momentoDoEncontro(encontro.inicio, encontro.duracao_minutos);
  const quando = quandoEhOEncontro(encontro.inicio, encontro.duracao_minutos);
  const dataPorExtenso = formatadorData.format(new Date(encontro.inicio));

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-2xl bg-sidebar text-sidebar-foreground sm:flex-row sm:items-center',
        compacto ? 'p-4' : 'p-5 sm:p-6',
        className,
      )}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-white text-sidebar',
          compacto ? 'h-10 w-10' : 'h-12 w-12',
        )}
      >
        <Video className={compacto ? 'h-[18px] w-[18px]' : 'h-5 w-5'} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-sidebar-accent">
          Próximo encontro · {quando}
        </p>
        <p className={cn('truncate font-semibold', compacto ? 'text-sm' : 'text-lg')}>{encontro.titulo}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-sidebar-muted">
          <Clock className="h-3.5 w-3.5" />
          {dataPorExtenso.charAt(0).toUpperCase() + dataPorExtenso.slice(1)}, às {horaCurta(encontro.inicio)}
        </p>
        {!compacto && encontro.descricao && (
          <p className="mt-2 whitespace-pre-line text-sm text-sidebar-muted">{encontro.descricao}</p>
        )}
      </div>
      {encontro.link && momento === 'agora' ? (
        <a
          href={encontro.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-sidebar transition-transform hover:-translate-y-0.5"
        >
          <Video className="h-4 w-4" /> Entrar na sala
        </a>
      ) : (
        !compacto && (
          <p className="shrink-0 text-xs text-sidebar-muted sm:max-w-[12rem] sm:text-right">
            {encontro.link
              ? 'O botão da sala aparece 15 minutos antes.'
              : 'O link da sala é enviado perto do horário.'}
          </p>
        )
      )}
    </div>
  );
}
