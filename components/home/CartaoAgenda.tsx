'use client';

import { CalendarHeart, Video } from 'lucide-react';
import { Cartao, LinkSeta } from '@/components/home/base';
import ProximoEncontro from '@/components/agenda/ProximoEncontro';
import { horaCurta, partesEmBrasilia, proximoEncontro, type Encontro } from '@/lib/agenda';
import { DATAS_COMEMORATIVAS } from '@/lib/datas-comemorativas';
import { nomeDoMes, partesDaData } from '@/lib/datas';
import type { Lembrete } from '@/lib/lembretes';
import type { DiaDaSemana, EntregaDaHome } from '@/lib/painel';
import { cn } from '@/lib/utils';

type TipoDoEvento = 'encontro' | 'entrega' | 'contato' | 'data';

interface Evento {
  chave: string;
  tipo: TipoDoEvento;
  texto: string;
  feito?: boolean;
}

const COR_DO_TIPO: Record<TipoDoEvento, string> = {
  encontro: 'bg-primary text-primary-foreground border-primary',
  entrega: 'bg-amber-100 text-amber-900 border-amber-200',
  contato: 'bg-violet-100 text-violet-900 border-violet-200',
  data: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200',
};

const LEGENDA: { tipo: TipoDoEvento; rotulo: string }[] = [
  { tipo: 'encontro', rotulo: 'Encontros' },
  { tipo: 'entrega', rotulo: 'Entregas' },
  { tipo: 'contato', rotulo: 'Contatos' },
  { tipo: 'data', rotulo: 'Datas comerciais' },
];

/** Quantos eventos cabem num dia antes de virar "+2". */
const POR_DIA = 3;

interface CartaoAgendaProps {
  semana: DiaDaSemana[];
  lembretes: Lembrete[];
  entregas: EntregaDaHome[];
  encontros: Encontro[];
  className?: string;
}

/**
 * A semana num relance: encontros da mentoria, entregas, contatos da agenda
 * e datas comerciais, dia a dia — com o próximo encontro em destaque no topo.
 */
export default function CartaoAgenda({ semana, lembretes, entregas, encontros, className }: CartaoAgendaProps) {
  const primeiro = semana[0];
  const ultimo = semana[semana.length - 1];

  const porDia = new Map<string, Evento[]>(semana.map((d) => [d.data, []]));
  const anotar = (data: string, evento: Evento) => porDia.get(data)?.push(evento);

  for (const e of encontros) {
    anotar(partesEmBrasilia(e.inicio).data, {
      chave: `n:${e.id}`,
      tipo: 'encontro',
      texto: `${horaCurta(e.inicio)} ${e.titulo}`,
    });
  }
  for (const e of entregas) {
    anotar(e.delivery_date, {
      chave: `e:${e.id}`,
      tipo: 'entrega',
      texto: e.cliente_nome || 'Entrega',
      feito: e.entregue,
    });
  }
  for (const l of lembretes) {
    anotar(l.data, {
      chave: `l:${l.id}`,
      tipo: 'contato',
      texto: l.cliente_nome || l.titulo,
      feito: l.concluido,
    });
  }
  if (primeiro && ultimo) {
    const { ano } = partesDaData(primeiro.data);
    for (const evento of DATAS_COMEMORATIVAS) {
      for (const alvo of [ano, ano + 1]) {
        const data = evento.quando(alvo);
        if (data >= primeiro.data && data <= ultimo.data) {
          anotar(data, { chave: `d:${evento.id}`, tipo: 'data', texto: evento.nome });
        }
      }
    }
  }

  const titulo = primeiro && ultimo ? tituloDaSemana(primeiro.data, ultimo.data) : 'Esta semana';
  const algumEvento = [...porDia.values()].some((lista) => lista.length > 0);

  return (
    <Cartao
      titulo="Agenda da semana"
      canto={<LinkSeta href="/dashboard/agenda" rotulo="Abrir a agenda" />}
      className={className}
    >
      <p className="-mt-0.5 text-sm text-muted-foreground">{titulo}</p>

      <ProximoEncontro className="mt-4" compacto encontro={proximoEncontro(encontros)} />

      {/* No celular, uma lista só com os dias que têm alguma coisa; a partir
          de `sm`, as sete colunas, como um calendário de verdade. */}
      <div className="mt-4 hidden grid-cols-7 gap-1.5 sm:grid">
        {semana.map((dia) => {
          const eventos = porDia.get(dia.data) ?? [];
          return (
            <div key={dia.data} className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-col items-center gap-1 pb-1">
                <span className={cn('text-xs', dia.hoje ? 'font-semibold text-primary' : 'text-muted-foreground')}>
                  {dia.rotulo}
                </span>
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm',
                    dia.hoje ? 'bg-primary font-semibold text-primary-foreground' : 'text-foreground',
                  )}
                >
                  {dia.dia}
                </span>
              </div>
              <div
                className={cn(
                  'flex min-h-[6rem] flex-col gap-1 rounded-xl border-l border-dashed border-border px-0.5 pt-1',
                  dia.hoje && 'bg-primary/5',
                )}
              >
                {eventos.slice(0, POR_DIA).map((evento) => (
                  <ChipDoEvento key={evento.chave} evento={evento} />
                ))}
                {eventos.length > POR_DIA && (
                  <span className="px-1 text-[11px] text-muted-foreground">
                    +{eventos.length - POR_DIA}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ul className="mt-4 space-y-3 sm:hidden">
        {semana
          .filter((dia) => (porDia.get(dia.data) ?? []).length > 0)
          .map((dia) => (
            <li key={dia.data} className="flex gap-3">
              <span
                className={cn(
                  'flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl text-xs leading-tight',
                  dia.hoje ? 'bg-primary text-primary-foreground' : 'bg-white text-foreground',
                )}
              >
                <span>{dia.rotulo}</span>
                <span className="text-sm font-semibold">{dia.dia}</span>
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                {(porDia.get(dia.data) ?? []).map((evento) => (
                  <ChipDoEvento key={evento.chave} evento={evento} />
                ))}
              </div>
            </li>
          ))}
      </ul>

      {!algumEvento && (
        <p className="mt-2 text-center text-sm text-muted-foreground sm:mt-3">
          Nenhuma entrega ou contato marcado pra esta semana.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {LEGENDA.map((item) => (
          <span key={item.tipo} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn('h-2.5 w-2.5 rounded-full border', COR_DO_TIPO[item.tipo])} />
            {item.rotulo}
          </span>
        ))}
      </div>
    </Cartao>
  );
}

function ChipDoEvento({ evento }: { evento: Evento }) {
  return (
    <span
      title={evento.texto}
      className={cn(
        'flex min-w-0 items-center gap-1 truncate rounded-lg border px-1.5 py-1 text-[11px] font-medium',
        COR_DO_TIPO[evento.tipo],
        evento.feito && 'opacity-50 line-through',
      )}
    >
      {evento.tipo === 'data' && <CalendarHeart className="h-3 w-3 shrink-0" />}
      {evento.tipo === 'encontro' && <Video className="h-3 w-3 shrink-0" />}
      <span className="truncate">{evento.texto}</span>
    </span>
  );
}

/** "25 a 31 de outubro" ou, virando o mês, "29 de outubro a 4 de novembro". */
function tituloDaSemana(inicio: string, fim: string): string {
  const a = partesDaData(inicio);
  const b = partesDaData(fim);
  if (a.mes === b.mes) return `${a.dia} a ${b.dia} de ${nomeDoMes(b.mes).toLowerCase()}`;
  return `${a.dia} de ${nomeDoMes(a.mes).toLowerCase()} a ${b.dia} de ${nomeDoMes(b.mes).toLowerCase()}`;
}
