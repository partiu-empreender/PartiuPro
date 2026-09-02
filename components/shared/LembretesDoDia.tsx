'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, BellRing } from 'lucide-react';
import ItemLembrete from '@/components/shared/ItemLembrete';
import { usarLembretes } from '@/lib/usar-lembretes';
import { hojeBrasil } from '@/lib/datas';

/** Quantos cabem sem o cartão virar uma segunda agenda dentro do Dashboard. */
const QUANTOS_MOSTRAR = 4;

/**
 * O que precisa de contato hoje, no Dashboard.
 *
 * A agenda inteira mora em /dashboard/lembretes. Aqui fica só o que já venceu,
 * porque o Dashboard é a tela que a aluna abre todo dia pra registrar venda —
 * é o único lugar onde a agenda encontra ela sem ser procurada. Sem isto, os
 * lembretes só existiriam pra quem lembrasse de ir olhar, que é o problema que
 * eles deveriam resolver.
 *
 * Some quando não há nada vencido: um cartão vazio ocupando o topo todo dia
 * treina a pessoa a ignorar aquele espaço.
 */
export default function LembretesDoDia() {
  // Pede só até hoje: o que vence semana que vem não é assunto desta tela.
  const { lembretes, resumo, carregando, concluir, adiar } = usarLembretes({ ate: hojeBrasil() });

  if (carregando || lembretes.length === 0) return null;

  const hoje = resumo?.hoje ?? hojeBrasil();
  const mostrados = lembretes.slice(0, QUANTOS_MOSTRAR);
  const restantes = lembretes.length - mostrados.length;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="space-y-3 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Pra falar hoje</h2>
            {resumo && resumo.atrasados > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                {resumo.atrasados} atrasado{resumo.atrasados > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <Link
            href="/dashboard/lembretes"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Ver a agenda <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="space-y-2">
          {mostrados.map((lembrete) => (
            <ItemLembrete
              key={lembrete.id}
              lembrete={lembrete}
              hoje={hoje}
              onConcluir={concluir}
              onAdiar={adiar}
            />
          ))}
        </div>

        {restantes > 0 && (
          <Link
            href="/dashboard/lembretes"
            className="block text-xs text-muted-foreground hover:underline"
          >
            + {restantes} {restantes > 1 ? 'outros' : 'outro'} esperando na agenda
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
