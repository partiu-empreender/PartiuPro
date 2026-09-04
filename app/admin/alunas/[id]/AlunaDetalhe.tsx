'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, ShoppingBag, Package, DollarSign, CalendarDays, TrendingUp } from 'lucide-react';
import PageShell from '@/components/shared/PageShell';
import CartaoIndicador from '@/components/shared/CartaoIndicador';
import { cn } from '@/lib/utils';
import { ROTULO_DO_PASSO, type PassoDoFunil } from '@/lib/ativacao';

interface Metricas {
  vendas: number;
  pa: number;
  conversao: number;
  atendimentos_hoje: number;
  faturamento_total: number;
  ticket_medio: number;
  faturamento_mes: number;
  total_itens: number;
}

interface Produto {
  id: string;
  name: string;
  price: number;
  cost: number;
}

interface VendaItemView {
  id: string;
  produto_nome: string;
  quantidade: number;
  subtotal: number;
}

interface Venda {
  id: string;
  data: string;
  cliente_nome: string;
  faturamento_total: number;
  venda_itens: VendaItemView[];
}

interface Atendimento {
  id: string;
  data: string;
  pessoas_atendidas: number;
}

interface ContaDaAluna {
  criada_em: string | null;
  ultimo_login: string | null;
  dias_sem_entrar: number | null;
  passo: PassoDoFunil;
  totais: {
    produtos: number;
    clientes: number;
    metas: number;
    vendas: number;
    atendimentos: number;
  };
}

interface DetalheData {
  perfil: { id: string; full_name: string; email: string; created_at?: string | null };
  conta?: ContaDaAluna;
  metricas: Metricas;
  meta_mensal: number;
  produtos: Produto[];
  vendas_recentes: Venda[];
  atendimentos_recentes: Atendimento[];
}

const POLL_MS = 20000;
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const COR_DO_PASSO: Record<PassoDoFunil, string> = {
  nunca_entrou: 'bg-destructive/10 text-destructive',
  entrou_sem_configurar: 'bg-orange-100 text-orange-700',
  configurou_sem_vender: 'bg-amber-100 text-amber-800',
  vendeu: 'bg-emerald-100 text-emerald-800',
};

const dataCurta = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('pt-BR');
};

const quandoEntrou = (dias: number | null) => {
  if (dias === null) return 'Nunca entrou no sistema';
  if (dias <= 0) return 'Entrou hoje';
  if (dias === 1) return 'Entrou ontem';
  return `Entrou há ${dias} dias`;
};

export default function AlunaDetalhe({ workspaceId }: { workspaceId: string }) {
  const [dados, setDados] = useState<DetalheData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = async () => {
    try {
      const res = await fetch(`/api/admin/alunas/${workspaceId}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao carregar dados da aluna');
      setDados(result.data);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar dados da aluna');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    const interval = setInterval(carregar, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  if (loading) {
    return (
      <PageShell>
        <p className="py-8 text-center text-muted-foreground">Carregando...</p>
      </PageShell>
    );
  }

  if (erro || !dados) {
    return (
      <PageShell>
        <p className="py-8 text-center text-destructive">{erro || 'Aluna não encontrada'}</p>
      </PageShell>
    );
  }

  const { perfil, conta, metricas, meta_mensal, produtos, vendas_recentes, atendimentos_recentes } =
    dados;
  const metaAlvo = meta_mensal > 0 ? meta_mensal : 0;
  const percentualMeta = metaAlvo > 0 ? (metricas.faturamento_mes / metaAlvo) * 100 : 0;

  const cards = [
    { title: 'Faturamento do mês', value: brl(metricas.faturamento_mes), icon: CalendarDays, color: 'text-blue-600' },
    { title: 'Vendas hoje', value: String(metricas.vendas), icon: ShoppingBag, color: 'text-green-600' },
    { title: 'PA', value: metricas.pa.toFixed(2), icon: Package, color: 'text-purple-600' },
    { title: 'Conversão', value: `${metricas.conversao.toFixed(1)}%`, icon: TrendingUp, color: 'text-emerald-600' },
    { title: 'Ticket médio', value: brl(metricas.ticket_medio), icon: DollarSign, color: 'text-orange-600' },
  ];

  return (
    <PageShell>
      <div>
        <Link href="/admin" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar ao painel
        </Link>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{perfil.full_name}</h1>
        <p className="mt-1 text-muted-foreground">{perfil.email} — atualiza automaticamente</p>
      </div>

      {/* Situação da conta. Vem ANTES dos números de venda de propósito: se a
          aluna nunca cadastrou nada, faturamento zero não é o problema dela —
          é consequência. A conversa que a mentora precisa ter é outra. */}
      {conta && (
        <Card>
          <CardHeader className="gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle>Situação da conta</CardTitle>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  COR_DO_PASSO[conta.passo],
                )}
              >
                {ROTULO_DO_PASSO[conta.passo]}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Cadastrou-se em</p>
                <p className="text-lg font-semibold">{dataCurta(conta.criada_em) ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Último acesso</p>
                <p className="text-lg font-semibold">{quandoEntrou(conta.dias_sem_entrar)}</p>
                {dataCurta(conta.ultimo_login) && (
                  <p className="text-xs text-muted-foreground">em {dataCurta(conta.ultimo_login)}</p>
                )}
              </div>
            </div>

            {/* O que ela já montou. Zero em tudo, com login recente, é o
                retrato de quem abriu e não soube por onde começar. */}
            <div className="flex flex-wrap gap-2">
              {[
                { rotulo: 'produto', plural: 'produtos', n: conta.totais.produtos },
                { rotulo: 'cliente', plural: 'clientes', n: conta.totais.clientes },
                { rotulo: 'meta', plural: 'metas', n: conta.totais.metas },
                { rotulo: 'venda', plural: 'vendas', n: conta.totais.vendas },
                { rotulo: 'atendimento', plural: 'atendimentos', n: conta.totais.atendimentos },
              ].map((item) => (
                <span
                  key={item.plural}
                  className={cn(
                    'rounded-xl border px-3 py-1.5 text-sm',
                    item.n > 0
                      ? 'border-white/60 bg-white/60'
                      : 'border-dashed border-muted-foreground/30 text-muted-foreground',
                  )}
                >
                  <strong>{item.n}</strong> {item.n === 1 ? item.rotulo : item.plural}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <CartaoIndicador
            key={c.title}
            titulo={c.title}
            valor={c.value}
            icone={c.icon}
            cor={c.color}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meta do mês</CardTitle>
        </CardHeader>
        <CardContent>
          {metaAlvo > 0 ? (
            <>
              <div className="mb-2 flex items-baseline justify-between text-sm">
                <span>{percentualMeta.toFixed(1)}% de {brl(metaAlvo)}</span>
                <span className="font-semibold">{brl(metricas.faturamento_mes)}</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, percentualMeta)}%` }} />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Essa aluna ainda não definiu uma meta pro mês.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Produtos ({produtos.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {produtos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum produto cadastrado.</p>
            ) : (
              produtos.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b pb-2 text-sm last:border-0">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground">{brl(p.price)} · custo {brl(p.cost)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Atendimentos recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {atendimentos_recentes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum atendimento registrado.</p>
            ) : (
              atendimentos_recentes.slice(0, 10).map((a) => (
                <div key={a.id} className="flex items-center justify-between border-b pb-2 text-sm last:border-0">
                  <span>{new Date(a.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                  <span className="text-muted-foreground">{a.pessoas_atendidas} pessoa(s)</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vendas recentes (mês atual)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {vendas_recentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma venda registrada este mês.</p>
          ) : (
            vendas_recentes.map((v) => (
              <div key={v.id} className="flex items-center justify-between border-b pb-2 text-sm last:border-0">
                <div>
                  <span className="font-medium">{v.cliente_nome}</span>
                  <span className="ml-2 text-muted-foreground">
                    {(v.venda_itens || []).map((i) => i.produto_nome).join(', ') || 'Sem itens'}
                  </span>
                </div>
                <span className="font-semibold">{brl(v.faturamento_total)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
