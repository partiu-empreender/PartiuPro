'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import PageShell from '@/components/shared/PageShell';
import PageHeader from '@/components/shared/PageHeader';
import CartaoIndicador from '@/components/shared/CartaoIndicador';
import { DollarSign, DoorOpen, ShoppingBag, Users } from 'lucide-react';
import { ROTULO_DO_PASSO, type PassoDoFunil, type ResumoDoFunil } from '@/lib/ativacao';

interface AlunaResumo {
  id: string;
  full_name: string;
  email: string;
  vendas_30d: number;
  faturamento_30d: number;
  ultima_venda_em: string | null;
  ultimo_login: string | null;
  dias_sem_entrar: number | null;
  passo: PassoDoFunil;
}

const POLL_MS = 20000;

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Cor por degrau: quem está mais longe da primeira venda aparece mais quente.
// É a ordem em que a mentora deve procurar as alunas.
const COR_DO_PASSO: Record<PassoDoFunil, string> = {
  nunca_entrou: 'bg-destructive/10 text-destructive',
  entrou_sem_configurar: 'bg-orange-100 text-orange-700',
  configurou_sem_vender: 'bg-amber-100 text-amber-800',
  vendeu: 'bg-emerald-100 text-emerald-800',
};

const COR_DA_BARRA: Record<PassoDoFunil, string> = {
  nunca_entrou: 'bg-destructive',
  entrou_sem_configurar: 'bg-orange-500',
  configurou_sem_vender: 'bg-amber-500',
  vendeu: 'bg-emerald-500',
};

/** "hoje", "ontem", "há 3 dias" — como se fala, não em ISO. */
function quandoEntrou(dias: number | null): string {
  if (dias === null) return 'Nunca entrou';
  if (dias <= 0) return 'Entrou hoje';
  if (dias === 1) return 'Entrou ontem';
  return `Entrou há ${dias} dias`;
}

export default function AdminResumo() {
  const [alunas, setAlunas] = useState<AlunaResumo[]>([]);
  const [funil, setFunil] = useState<ResumoDoFunil | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<PassoDoFunil | 'todas'>('todas');

  const carregar = async () => {
    try {
      const res = await fetch('/api/admin/resumo');
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao carregar resumo');
      setAlunas(result.data || []);
      setFunil(result.funil ?? null);
    } catch (error) {
      console.error('Erro ao carregar resumo admin:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    const interval = setInterval(carregar, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const faturamentoTotal = alunas.reduce((sum, a) => sum + a.faturamento_30d, 0);
  const visiveis = filtro === 'todas' ? alunas : alunas.filter((a) => a.passo === filtro);

  // Quem travou antes de cadastrar qualquer coisa: já provou interesse e
  // parou no começo. É o grupo que rende mais atenção hoje.
  const travadas = funil ? funil.entraramSemConfigurar + funil.nuncaEntraram : 0;

  const degraus: { passo: PassoDoFunil; quantas: number }[] = funil
    ? [
        { passo: 'nunca_entrou', quantas: funil.nuncaEntraram },
        { passo: 'entrou_sem_configurar', quantas: funil.entraramSemConfigurar },
        { passo: 'configurou_sem_vender', quantas: funil.configuraramSemVender },
        { passo: 'vendeu', quantas: funil.venderam },
      ]
    : [];

  return (
    <PageShell>
      <PageHeader
        title="Painel Administrativo"
        description="Onde cada aluna parou no caminho até a primeira venda (atualiza automaticamente)"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CartaoIndicador titulo="Alunas cadastradas" valor={String(alunas.length)} icone={Users} />
        <CartaoIndicador
          titulo="Entraram nas últimas 24h"
          valor={funil ? String(funil.ativasEm24h) : '—'}
          icone={DoorOpen}
          cor="text-blue-600"
        />
        {/* O número que decide o dia da mentora. */}
        <CartaoIndicador
          titulo="Travadas antes de cadastrar"
          valor={funil ? String(travadas) : '—'}
          icone={ShoppingBag}
          cor="text-orange-600"
        />
        <CartaoIndicador
          titulo="Faturamento consolidado (30d)"
          valor={brl(faturamentoTotal)}
          icone={DollarSign}
          cor="text-emerald-600"
        />
      </div>

      {funil && funil.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Funil de ativação</CardTitle>
            <CardDescription>
              O caminho que a ferramenta pede: entrar, cadastrar alguma coisa (produto,
              cliente ou meta) e registrar a primeira venda. Toque num degrau pra ver quem
              está nele.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {degraus.map(({ passo, quantas }) => {
              const pct = funil.total > 0 ? (quantas / funil.total) * 100 : 0;
              const ativo = filtro === passo;
              return (
                <button
                  key={passo}
                  type="button"
                  onClick={() => setFiltro(ativo ? 'todas' : passo)}
                  aria-pressed={ativo}
                  className={cn(
                    'w-full rounded-2xl border p-3 text-left transition-colors',
                    ativo
                      ? 'border-primary bg-primary/5'
                      : 'border-white/60 bg-white/50 hover:bg-accent',
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold">{ROTULO_DO_PASSO[passo]}</span>
                    <span className="text-sm text-muted-foreground">
                      <strong className="text-base text-foreground">{quantas}</strong> de{' '}
                      {funil.total}
                    </span>
                  </div>
                  {/* Barra à mão: o projeto não tem componente de progresso, e
                      AlunaDetalhe já resolve assim. */}
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full transition-all', COR_DA_BARRA[passo])}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Alunas
            {filtro !== 'todas' && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                · {ROTULO_DO_PASSO[filtro]}
              </span>
            )}
          </CardTitle>
          <CardDescription>
            {filtro === 'todas'
              ? 'Ordenado por faturamento nos últimos 30 dias — clique pra ver o detalhe'
              : 'Clique no degrau de novo pra ver todas'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {loading ? (
              <p className="py-8 text-center text-muted-foreground">Carregando...</p>
            ) : visiveis.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                {alunas.length === 0
                  ? 'Nenhuma aluna cadastrada ainda'
                  : 'Nenhuma aluna neste degrau'}
              </p>
            ) : (
              visiveis.map((aluna) => (
                <Link
                  key={aluna.id}
                  href={`/admin/alunas/${aluna.id}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/60 bg-white/50 p-4 transition-colors hover:bg-accent"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate font-semibold">{aluna.full_name}</h4>
                    <p className="truncate text-sm text-muted-foreground">{aluna.email}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {/* O degrau, escrito. Antes esta linha dizia só "Nenhuma
                          venda registrada" pra três situações diferentes — e a
                          mentora não sabia a quem ligar. */}
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          COR_DO_PASSO[aluna.passo],
                        )}
                      >
                        {ROTULO_DO_PASSO[aluna.passo]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {quandoEntrou(aluna.dias_sem_entrar)}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold">{brl(aluna.faturamento_30d)}</p>
                    <p className="text-sm text-muted-foreground">{aluna.vendas_30d} venda(s)</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
