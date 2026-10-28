'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BellRing, Cake, Check, HeartHandshake, Truck, Wallet } from 'lucide-react';
import { brl, dataCurta } from '@/components/home/base';
import type { EntregaDaHome } from '@/lib/painel';
import type { Lembrete } from '@/lib/lembretes';
import { cn } from '@/lib/utils';

interface Tarefa {
  chave: string;
  icone: typeof BellRing;
  titulo: string;
  detalhe: string;
  feita: boolean;
  atrasada: boolean;
  alternar: () => Promise<void> | void;
}

interface CartaoTarefasProps {
  hoje: string;
  lembretes: Lembrete[];
  entregas: EntregaDaHome[];
  aReceber: { quantidade: number; valor: number };
  concluirLembrete: (lembrete: Lembrete, feito: boolean) => Promise<void>;
  alternarEntrega: (entrega: EntregaDaHome, entregue: boolean) => Promise<void>;
  aoVerPendencias: () => void;
  className?: string;
}

const ICONE_DA_ORIGEM: Record<Lembrete['origem'], typeof BellRing> = {
  manual: BellRing,
  aniversario: Cake,
  'cliente-ha-um-ano': HeartHandshake,
  'retomar-contato': HeartHandshake,
};

/**
 * O que fazer hoje, com check — o cartão escuro e alto da home.
 *
 * Junta as duas coisas que têm dia marcado no sistema: os contatos da agenda
 * e as entregas. O que venceu e não foi feito continua aparecendo, marcado
 * como atrasado; o que ela marcou hoje fica na lista riscado, pra o "2/8"
 * mostrar o dia andando em vez de a lista simplesmente encolher.
 *
 * Quando o plano de 60 dias existir, a tarefa do plano entra aqui no topo.
 */
export default function CartaoTarefas({
  hoje,
  lembretes,
  entregas,
  aReceber,
  concluirLembrete,
  alternarEntrega,
  aoVerPendencias,
  className,
}: CartaoTarefasProps) {
  const [mexendo, setMexendo] = useState<string | null>(null);

  const tarefas: Tarefa[] = [
    ...entregas
      .filter((e) => (e.entregue ? e.delivery_date === hoje : e.delivery_date <= hoje))
      .map<Tarefa>((e) => ({
        chave: `entrega:${e.id}`,
        icone: Truck,
        titulo: `Entregar pra ${e.cliente_nome || 'cliente'}`,
        detalhe:
          e.delivery_date < hoje
            ? `Atrasada desde ${dataCurta(e.delivery_date)}`
            : `Hoje${e.delivery_period ? ` · ${e.delivery_period}` : ''}`,
        feita: e.entregue,
        atrasada: !e.entregue && e.delivery_date < hoje,
        alternar: () => alternarEntrega(e, !e.entregue),
      })),
    ...lembretes
      .filter((l) => (l.concluido ? l.data === hoje : l.data <= hoje))
      .map<Tarefa>((l) => ({
        chave: `lembrete:${l.id}`,
        icone: ICONE_DA_ORIGEM[l.origem] ?? BellRing,
        titulo: l.titulo,
        detalhe: [
          l.cliente_nome,
          l.data < hoje ? `desde ${dataCurta(l.data)}` : 'hoje',
        ]
          .filter(Boolean)
          .join(' · '),
        feita: l.concluido,
        atrasada: !l.concluido && l.data < hoje,
        alternar: () => concluirLembrete(l, !l.concluido),
      })),
  ];

  // As pendentes primeiro (atrasadas no topo), as feitas embaixo.
  tarefas.sort((a, b) => Number(a.feita) - Number(b.feita) || Number(b.atrasada) - Number(a.atrasada));

  const feitas = tarefas.filter((t) => t.feita).length;

  const alternar = async (tarefa: Tarefa) => {
    setMexendo(tarefa.chave);
    try {
      await tarefa.alternar();
    } finally {
      setMexendo(null);
    }
  };

  return (
    <section
      className={cn(
        'flex min-h-[24rem] flex-col rounded-[1.75rem] bg-sidebar p-5 text-sidebar-foreground shadow-lift',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">Tarefas de hoje</h2>
        <span className="text-3xl font-light tabular-nums">
          {feitas}/{tarefas.length}
        </span>
      </div>

      {tarefas.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
            <Check className="h-6 w-6 text-sidebar-accent" />
          </span>
          <p className="max-w-[16rem] text-sm text-sidebar-muted">
            Nada marcado pra hoje. Bom momento pra chamar uma cliente que não compra há um tempo.
          </p>
        </div>
      ) : (
        <ul className="-mx-1 mt-4 flex-1 space-y-1 overflow-y-auto px-1 xl:max-h-[26rem]">
          {tarefas.map((tarefa) => {
            const Icone = tarefa.icone;
            return (
              <li key={tarefa.chave} className="flex items-center gap-3 rounded-2xl px-1 py-2">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-sidebar">
                  <Icone className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'truncate text-sm font-medium',
                      tarefa.feita && 'text-sidebar-muted line-through',
                    )}
                  >
                    {tarefa.titulo}
                  </p>
                  <p
                    className={cn(
                      'truncate text-xs',
                      tarefa.atrasada ? 'text-red-300' : 'text-sidebar-muted',
                    )}
                  >
                    {tarefa.detalhe}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => alternar(tarefa)}
                  disabled={mexendo === tarefa.chave}
                  aria-pressed={tarefa.feita}
                  aria-label={tarefa.feita ? `Desmarcar: ${tarefa.titulo}` : `Marcar como feito: ${tarefa.titulo}`}
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:opacity-50',
                    tarefa.feita
                      ? 'border-sidebar-accent bg-sidebar-accent text-white'
                      : 'border-white/50 hover:border-white',
                  )}
                >
                  {tarefa.feita && <Check className="h-4 w-4" strokeWidth={3} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 space-y-1 border-t border-white/10 pt-3">
        {aReceber.quantidade > 0 && (
          <button
            type="button"
            onClick={aoVerPendencias}
            className="group flex w-full items-center gap-3 rounded-2xl px-1 py-2 text-left transition-colors hover:bg-white/10"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
              <Wallet className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <span className="font-medium">{brl(aReceber.valor)}</span>{' '}
              <span className="text-sidebar-muted">
                a receber · {aReceber.quantidade} {aReceber.quantidade === 1 ? 'venda' : 'vendas'}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-sidebar-muted transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
        <Link
          href="/dashboard/lembretes"
          className="flex items-center justify-center gap-1 rounded-2xl py-2 text-sm font-medium text-sidebar-accent transition-colors hover:bg-white/10"
        >
          Abrir a agenda completa <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
