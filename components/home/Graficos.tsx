'use client';

import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, Target } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Cartao, LinkSeta, Vazio, brl, brlCurto } from '@/components/home/base';
import type { ResumoDoMes } from '@/lib/home';
import type { FatiaDaForma, Recebimento } from '@/lib/painel';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------------ */
/* Faturamento: o número do mês e as barras dos últimos seis                 */
/* ------------------------------------------------------------------------ */

export function CartaoFaturamento({
  resumo,
  meses,
  className,
}: {
  resumo: ResumoDoMes;
  meses: { rotulo: string; total: number; atual: boolean }[];
  className?: string;
}) {
  const maior = Math.max(...meses.map((m) => m.total), 0);
  // Teto "redondo" do eixo, pra as marcas lerem como números de gente.
  const teto = maior > 0 ? tetoRedondo(maior) : 1;
  const marcas = [teto, teto / 2, 0];

  return (
    <Cartao titulo="Faturamento" canto={<LinkSeta href="/dashboard/historico" rotulo="Ver o histórico" />} className={className}>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
        <p className="text-4xl font-bold tracking-tight text-foreground">{brl(resumo.vendido)}</p>
        <p className="text-sm text-muted-foreground">em {resumo.mes.toLowerCase()}</p>
      </div>
      <Comparacao resumo={resumo} />

      {/* Barras finas e arredondadas, uma por mês. O mês atual vem escuro e
          com o valor numa etiqueta em cima; os outros mostram o valor ao
          passar o mouse. A altura é fixa: em porcentagem de um pai flexível,
          as barras encolhiam até sumir. */}
      <div className="mt-5 flex gap-3">
        <div className="flex h-36 flex-col justify-between text-right text-[11px] leading-none text-muted-foreground">
          {marcas.map((m) => (
            <span key={m}>{m === 0 ? '0' : brlCurto(m)}</span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex h-36 items-end justify-between gap-2 border-b border-dashed border-border">
            {meses.map((m) => (
              <div key={m.rotulo} className="relative flex h-full flex-1 items-end justify-center">
                {m.atual && m.total > 0 && (
                  <span
                    className="absolute z-10 whitespace-nowrap rounded-lg bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground shadow-soft"
                    style={{ bottom: `calc(${(m.total / teto) * 100}% + 6px)` }}
                  >
                    {brlCurto(m.total)}
                  </span>
                )}
                <div
                  title={`${m.rotulo}: ${brl(m.total)}`}
                  className={cn('w-3 rounded-t-full sm:w-3.5', m.atual ? 'bg-primary' : 'bg-primary/35')}
                  style={{ height: `${Math.max(3, (m.total / teto) * 100)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between gap-2">
            {meses.map((m) => (
              <span
                key={m.rotulo}
                className={cn(
                  'flex-1 text-center text-xs',
                  m.atual ? 'font-semibold text-foreground' : 'text-muted-foreground',
                )}
              >
                {m.rotulo}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Cartao>
  );
}

/** O menor número "redondo" (1, 1,5, 2, 2,5, 3, 4, 5, 6, 8 × 10ⁿ) que cabe o valor. */
function tetoRedondo(n: number): number {
  const potencia = 10 ** Math.floor(Math.log10(n));
  for (const passo of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (passo * potencia >= n) return passo * potencia;
  }
  return 10 * potencia;
}

function Comparacao({ resumo }: { resumo: ResumoDoMes }) {
  if (resumo.variacao === null) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        {resumo.quantidade} {resumo.quantidade === 1 ? 'venda' : 'vendas'} no mês
      </p>
    );
  }

  const subiu = resumo.variacao >= 0;
  const Seta = subiu ? ArrowUpRight : ArrowDownRight;
  return (
    <p
      className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
      title={`De 1 a ${resumo.diaLimiteAnterior} de ${resumo.mesAnterior.toLowerCase()}: ${brl(resumo.vendidoAntes)}`}
    >
      <span
        className={cn(
          'inline-flex items-center gap-0.5 font-semibold',
          subiu ? 'text-emerald-600' : 'text-amber-700',
        )}
      >
        <Seta className="h-4 w-4" />
        {Math.abs(Math.round(resumo.variacao))}%
      </span>
      vs. 1 a {resumo.diaLimiteAnterior} de {resumo.mesAnterior.toLowerCase()}
    </p>
  );
}

/* ------------------------------------------------------------------------ */
/* Meta: o anel                                                              */
/* ------------------------------------------------------------------------ */

export function CartaoMeta({
  vendido,
  meta,
  diasRestantes,
  className,
}: {
  vendido: number;
  meta: number;
  diasRestantes: number;
  className?: string;
}) {
  const percentual = meta > 0 ? (vendido / meta) * 100 : 0;
  const falta = Math.max(0, meta - vendido);

  const raio = 64;
  const circunferencia = 2 * Math.PI * raio;
  const preenchido = Math.min(100, percentual) / 100;

  return (
    <Cartao titulo="Meta do mês" canto={<LinkSeta href="/dashboard/metas" rotulo="Abrir metas" />} className={className}>
      <div className="relative mx-auto mt-2 h-44 w-44">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" aria-hidden>
          {/* Os tracinhos em volta, como num relógio. */}
          <circle cx="80" cy="80" r="76" fill="none" stroke="hsl(var(--muted-foreground) / 0.35)" strokeWidth="3" strokeDasharray="1.5 5" />
          <circle cx="80" cy="80" r={raio} fill="none" stroke="hsl(var(--primary) / 0.12)" strokeWidth="12" />
          <circle
            cx="80"
            cy="80"
            r={raio}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${circunferencia * preenchido} ${circunferencia}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {meta > 0 ? (
            <>
              <span className="text-4xl font-bold text-foreground">{Math.round(percentual)}%</span>
              <span className="text-xs text-muted-foreground">da meta</span>
            </>
          ) : (
            <span className="px-6 text-sm text-muted-foreground">Sem meta pra este mês</span>
          )}
        </div>
      </div>

      <div className="mt-auto flex items-end justify-between gap-3 pt-3">
        {meta > 0 ? (
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-foreground">
              {falta > 0 ? `Faltam ${brl(falta)}` : 'Meta batida!'}
            </p>
            <p className="text-xs text-muted-foreground">
              de {brl(meta)} · {diasRestantes} {diasRestantes === 1 ? 'dia' : 'dias'} pro fim do mês
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Defina quanto quer vender no mês.</p>
        )}
        <Link
          href="/dashboard/metas"
          aria-label={meta > 0 ? 'Ajustar meta' : 'Definir meta'}
          title={meta > 0 ? 'Ajustar meta' : 'Definir meta'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sidebar text-sidebar-foreground transition-transform hover:-translate-y-0.5"
        >
          <Target className="h-5 w-5" />
        </Link>
      </div>
    </Cartao>
  );
}

/* ------------------------------------------------------------------------ */
/* Recebido: a barra em partes                                               */
/* ------------------------------------------------------------------------ */

export function CartaoRecebido({
  recebimento,
  className,
}: {
  recebimento: Recebimento;
  className?: string;
}) {
  const pago = recebimento.percentualPago;
  const aReceber = pago === null ? null : 100 - pago;

  return (
    <Cartao
      titulo="Recebido no mês"
      canto={
        <span className="text-3xl font-bold text-foreground">
          {pago === null ? '—' : `${Math.round(pago)}%`}
        </span>
      }
      className={className}
    >
      {pago === null ? (
        <p className="mt-3 text-sm text-muted-foreground">Aparece com a primeira venda do mês.</p>
      ) : (
        <>
          <div className="mt-3 flex justify-between text-xs text-muted-foreground">
            <span>{Math.round(pago)}% pago</span>
            <span>{Math.round(aReceber ?? 0)}% a receber</span>
          </div>
          {/* Duas partes proporcionais. A menor nunca some de todo: 4% de
              largura mínima, senão "quase tudo pago" pareceria "tudo pago". */}
          <div className="mt-1.5 flex h-11 gap-1">
            {pago > 0 && (
              <div
                className="flex items-center overflow-hidden rounded-2xl bg-primary px-3 text-sm font-medium text-primary-foreground"
                style={{ width: `${Math.max(4, pago)}%` }}
              >
                {pago >= 25 && 'Pago'}
              </div>
            )}
            {(aReceber ?? 0) > 0 && (
              <div
                className="flex items-center justify-end overflow-hidden rounded-2xl bg-sidebar px-3 text-sm font-medium text-sidebar-foreground"
                style={{ width: `${Math.max(4, aReceber ?? 0)}%` }}
                title={`A receber: ${brl(recebimento.aReceber)}`}
              >
                {(aReceber ?? 0) >= 30 && 'A receber'}
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {brl(recebimento.pago)} pago · {brl(recebimento.aReceber)} a receber
          </p>
        </>
      )}
    </Cartao>
  );
}

/* ------------------------------------------------------------------------ */
/* Formas de pagamento: a pizza                                              */
/* ------------------------------------------------------------------------ */

const CORES_DA_PIZZA = ['#6d28d9', '#a78bfa', '#2e1065', '#c084fc', '#ddd6fe', '#d1d5db'];

export function CartaoFormas({ formas, className }: { formas: FatiaDaForma[]; className?: string }) {
  const total = formas.reduce((s, f) => s + f.total, 0);
  const quantidade = formas.reduce((s, f) => s + f.quantidade, 0);

  return (
    <Cartao titulo="Como pagaram" className={className}>
      {formas.length === 0 ? (
        <Vazio>As formas de pagamento das vendas do mês aparecem aqui.</Vazio>
      ) : (
        <div className="mt-2 flex flex-1 flex-col gap-4">
          <div className="relative mx-auto h-40 w-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={formas}
                  dataKey="total"
                  nameKey="rotulo"
                  innerRadius="62%"
                  outerRadius="100%"
                  paddingAngle={2}
                  cornerRadius={6}
                  stroke="none"
                >
                  {formas.map((f, i) => (
                    <Cell key={f.rotulo} fill={CORES_DA_PIZZA[i % CORES_DA_PIZZA.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => brl(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-foreground">{quantidade}</span>
              <span className="text-[11px] text-muted-foreground">vendas</span>
            </div>
          </div>
          <ul className="space-y-1.5 text-sm">
            {formas.map((f, i) => (
              <li key={f.rotulo} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: CORES_DA_PIZZA[i % CORES_DA_PIZZA.length] }}
                />
                <span className="flex-1 truncate text-foreground">{f.rotulo}</span>
                <span className="font-medium text-foreground">
                  {total > 0 ? Math.round((f.total / total) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Cartao>
  );
}
