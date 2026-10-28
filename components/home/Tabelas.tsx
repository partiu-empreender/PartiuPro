'use client';

import { Cartao, Vazio, brl, dataCurta } from '@/components/home/base';
import type { PainelDaHome } from '@/lib/painel';
import { cn } from '@/lib/utils';

/** Os produtos que mais faturaram no mês. */
export function CartaoMaisVendidos({
  produtos,
  mes,
  className,
}: {
  produtos: PainelDaHome['maisVendidos'];
  mes: string;
  className?: string;
}) {
  const maior = Math.max(...produtos.map((p) => p.total), 0);

  return (
    <Cartao titulo="Mais vendidos" canto={<span className="text-sm text-muted-foreground">{mes}</span>} className={className}>
      {produtos.length === 0 ? (
        <Vazio>Os produtos que mais venderam no mês aparecem aqui.</Vazio>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-2 font-medium">Produto</th>
              <th className="pb-2 text-right font-medium">Qtd.</th>
              <th className="pb-2 text-right font-medium">Faturado</th>
            </tr>
          </thead>
          <tbody>
            {produtos.map((p, i) => (
              <tr key={p.nome} className="border-t border-border/60">
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                        i === 0 ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{p.nome}</p>
                      {/* A barrinha mostra o peso de cada um contra o primeiro. */}
                      <div className="mt-1 h-1 rounded-full bg-primary/10">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{ width: `${maior > 0 ? (p.total / maior) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                  {p.quantidade.toLocaleString('pt-BR')}
                </td>
                <td className="py-2.5 pl-3 text-right font-medium tabular-nums text-foreground">
                  {brl(p.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Cartao>
  );
}

/** As últimas vendas do mês, com a situação do pagamento. */
export function CartaoUltimasVendas({
  vendas,
  aoVerTodas,
  className,
}: {
  vendas: PainelDaHome['ultimasVendas'];
  aoVerTodas: () => void;
  className?: string;
}) {
  return (
    <Cartao
      titulo="Últimas vendas"
      canto={
        <button
          type="button"
          onClick={aoVerTodas}
          className="text-sm font-medium text-primary hover:underline"
        >
          Ver todas
        </button>
      }
      className={className}
    >
      {vendas.length === 0 ? (
        <Vazio>As vendas registradas no mês aparecem aqui.</Vazio>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-2 font-medium">Cliente</th>
              <th className="pb-2 font-medium">Data</th>
              <th className="pb-2 text-right font-medium">Valor</th>
              <th className="hidden pb-2 text-right font-medium sm:table-cell">Situação</th>
            </tr>
          </thead>
          <tbody>
            {vendas.map((v) => {
              const pago = v.status === 'pago';
              return (
                <tr key={v.id} className="border-t border-border/60">
                  <td className="max-w-0 truncate py-2.5 pr-3 font-medium text-foreground">
                    {v.cliente_nome || 'Sem nome'}
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">{dataCurta(v.data)}</td>
                  <td className="py-2.5 text-right font-medium tabular-nums text-foreground">
                    {brl(v.valor)}
                  </td>
                  <td className="hidden py-2.5 pl-3 text-right sm:table-cell">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1 text-xs font-medium',
                        pago ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800',
                      )}
                    >
                      {pago ? 'Pago' : 'A receber'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Cartao>
  );
}
