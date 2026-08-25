'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, ShoppingBag, Package, DollarSign, CalendarDays, TrendingUp } from 'lucide-react';

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

interface DetalheData {
  perfil: { id: string; full_name: string; email: string };
  metricas: Metricas;
  meta_mensal: number;
  produtos: Produto[];
  vendas_recentes: Venda[];
  atendimentos_recentes: Atendimento[];
}

const POLL_MS = 20000;
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
    return <p className="container mx-auto p-6 text-center text-muted-foreground">Carregando...</p>;
  }

  if (erro || !dados) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-destructive">{erro || 'Aluna não encontrada'}</p>
      </div>
    );
  }

  const { perfil, metricas, meta_mensal, produtos, vendas_recentes, atendimentos_recentes } = dados;
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
    <div className="container mx-auto p-6">
      <Link href="/admin" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar ao painel
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">{perfil.full_name}</h1>
        <p className="mt-1 text-muted-foreground">{perfil.email} — atualiza automaticamente</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5 mb-8">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{c.title}</CardTitle>
                <Icon className={`h-4 w-4 ${c.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{c.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mb-8">
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

      <Card className="mt-6">
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
    </div>
  );
}
