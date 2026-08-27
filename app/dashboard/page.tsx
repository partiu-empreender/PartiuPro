'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PricingCalculator from '@/components/PricingCalculator';
import { calcularRelatorioMensal, type RelatorioMensal } from '@/lib/metrics';
import PageShell from '@/components/shared/PageShell';
import PageHeader from '@/components/shared/PageHeader';
import {
  ShoppingBag,
  Package,
  Plus,
  DollarSign,
  Trash2,
  TrendingUp,
  Users,
  Target,
  Lightbulb,
  Rocket,
} from 'lucide-react';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CORES_FAIXA: Record<RelatorioMensal['faixas'][number]['tipo'], string> = {
  baixa: '#dc2626',
  media: '#d97706',
  alta: '#16a34a',
  unica: '#7c3aed',
};

const rotuloFaixa = (faixa: RelatorioMensal['faixas'][number]) => {
  if (faixa.tipo === 'unica') return 'Todas as vendas';
  if (faixa.tipo === 'baixa') return `Até ${brl(faixa.max)}`;
  if (faixa.tipo === 'media') return `Entre ${brl(faixa.min)} e ${brl(faixa.max)}`;
  return `Acima de ${brl(faixa.min)}`;
};

interface VendaItemView {
  id: string;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

interface VendaDiaria {
  id: string;
  data: string;
  cliente_nome: string;
  faturamento_total: number;
  status: string;
  venda_itens: VendaItemView[];
}

type TipoProduto = 'produto' | 'adicional';

interface ProdutoCatalogo {
  id: string;
  name: string;
  price: number;
  tipo: TipoProduto;
}

interface NovoItemForm {
  produto_id?: string;
  produto_nome: string;
  quantidade: string;
  preco_unitario: string;
}

const itemVazio = (): NovoItemForm => ({ produto_nome: '', quantidade: '1', preco_unitario: '' });

const itemEstaVazio = (item: NovoItemForm) =>
  !item.produto_nome.trim() && !item.preco_unitario.trim();

export default function DashboardPage() {
  const [vendas, setVendas] = useState<VendaDiaria[]>([]);
  const [relatorio, setRelatorio] = useState<RelatorioMensal | null>(null);
  const [catalogo, setCatalogo] = useState<ProdutoCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('relatorio');
  const [showRegistroVendaModal, setShowRegistroVendaModal] = useState(false);
  // Só a primeira carga mostra "Carregando..." — as atualizações de 30 em 30s
  // acontecem em silêncio, senão a tela inteira pisca a cada polling.
  const jaCarregou = useRef(false);

  // Form de registro de venda
  const [clienteNome, setClienteNome] = useState('');
  const [itens, setItens] = useState<NovoItemForm[]>([itemVazio()]);
  const [salvando, setSalvando] = useState(false);
  const [formError, setFormError] = useState('');

  const carregarMetricas = async () => {
    try {
      const anoAtual = new Date().getFullYear();
      const mesAtual = new Date().getMonth() + 1;

      const [resVendas, resMetas, resProdutos] = await Promise.all([
        fetch('/api/vendas'),
        fetch(`/api/metas?ano=${anoAtual}`),
        fetch('/api/produtos'),
      ]);
      const result = await resVendas.json();
      const metasResult = await resMetas.json();
      const produtosResult = await resProdutos.json();

      if (!resVendas.ok) throw new Error(result.error || 'Erro ao carregar vendas');

      setVendas(result.vendas || []);
      setCatalogo(resProdutos.ok ? produtosResult.data || [] : []);

      const metaDoMes: number =
        (metasResult.data || []).find((m: { mes: number; meta_mensal: number }) => m.mes === mesAtual)
          ?.meta_mensal || 0;

      setRelatorio(
        calcularRelatorioMensal(result.vendas_mes || [], result.atendimentos_mes || 0, metaDoMes),
      );
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    } finally {
      if (!jaCarregou.current) {
        jaCarregou.current = true;
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    carregarMetricas();
    const interval = setInterval(carregarMetricas, 30000);
    return () => clearInterval(interval);
  }, []);

  const abrirModal = () => {
    setClienteNome('');
    setItens([itemVazio()]);
    setFormError('');
    setShowRegistroVendaModal(true);
  };

  const atualizarItem = (index: number, campo: keyof NovoItemForm, valor: string) => {
    setItens((atual) =>
      atual.map((item, i) => {
        if (i !== index) return item;
        // Editar nome ou preço à mão desfaz o vínculo com o produto do catálogo.
        const desvincula = campo === 'produto_nome' || campo === 'preco_unitario';
        return { ...item, [campo]: valor, ...(desvincula ? { produto_id: undefined } : {}) };
      }),
    );
  };

  const adicionarItem = () => setItens((atual) => [...atual, itemVazio()]);
  const removerItem = (index: number) => setItens((atual) => atual.filter((_, i) => i !== index));

  // Atalho do catálogo: preenche a última linha se ela estiver em branco,
  // senão adiciona uma nova — evita deixar linha vazia sobrando.
  const aplicarProduto = (produto: ProdutoCatalogo) => {
    const novoItem: NovoItemForm = {
      produto_id: produto.id,
      produto_nome: produto.name,
      quantidade: '1',
      preco_unitario: String(produto.price),
    };
    setItens((atual) => {
      const ultimo = atual[atual.length - 1];
      if (ultimo && itemEstaVazio(ultimo)) {
        return [...atual.slice(0, -1), novoItem];
      }
      return [...atual, novoItem];
    });
  };

  const totalVenda = itens.reduce((sum, item) => {
    const qtd = parseFloat(item.quantidade) || 0;
    const preco = parseFloat(item.preco_unitario) || 0;
    return sum + qtd * preco;
  }, 0);

  const registrarVenda = async () => {
    setFormError('');

    if (!clienteNome.trim()) {
      setFormError('Informe o nome do cliente');
      return;
    }

    const itensValidos = itens.filter((item) => item.produto_nome.trim());
    if (itensValidos.length === 0) {
      setFormError('Adicione pelo menos um item');
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch('/api/vendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_nome: clienteNome.trim(),
          items: itensValidos.map((item) => ({
            produto_id: item.produto_id,
            produto_nome: item.produto_nome.trim(),
            quantidade: parseFloat(item.quantidade) || 1,
            preco_unitario: parseFloat(item.preco_unitario) || 0,
          })),
        }),
      });
      const result = await res.json();

      if (!res.ok) {
        setFormError(result.error || 'Erro ao registrar venda');
        return;
      }

      setShowRegistroVendaModal(false);
      await carregarMetricas();
    } catch {
      setFormError('Erro ao registrar venda. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <PageShell>
        <PageHeader
          title="Dashboard de Vendas"
          description="Visão geral do seu negócio em tempo real"
          action={
            <Button onClick={abrirModal} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Registrar Venda
            </Button>
          }
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="relatorio">Relatório do Mês</TabsTrigger>
            <TabsTrigger value="hoje">Vendas do Dia</TabsTrigger>
            <TabsTrigger value="precificacao">Precificação</TabsTrigger>
          </TabsList>

          <TabsContent value="relatorio" className="space-y-6 mt-4">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : !relatorio || relatorio.vendas_realizadas === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Registre sua primeira venda do mês pra ver o relatório completo.
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  {[
                    { title: 'Faturamento bruto', value: brl(relatorio.faturamento_mes), icon: DollarSign, color: 'text-blue-600' },
                    { title: 'Produtos vendidos', value: String(relatorio.produtos_vendidos), icon: ShoppingBag, color: 'text-green-600' },
                    { title: 'Ticket médio', value: brl(relatorio.ticket_medio_mes), icon: Package, color: 'text-purple-600' },
                    { title: 'Atendimentos realizados', value: String(relatorio.atendimentos_mes), icon: Users, color: 'text-orange-600' },
                    { title: 'Vendas realizadas', value: String(relatorio.vendas_realizadas), icon: TrendingUp, color: 'text-emerald-600' },
                    {
                      title: 'Conversão geral',
                      value: relatorio.atendimentos_mes > 0 ? `${relatorio.conversao_mes.toFixed(1)}%` : '—',
                      icon: Target,
                      color: 'text-pink-600',
                    },
                  ].map((c) => {
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

                <Card>
                  <CardHeader>
                    <CardTitle>Distância da meta</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
                    {relatorio.meta_mensal > 0 ? (
                      <>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Meta do mês</p>
                            <p className="text-xl font-bold">{brl(relatorio.meta_mensal)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Resultado atual</p>
                            <p className="text-xl font-bold">{brl(relatorio.faturamento_mes)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Falta para a meta</p>
                            <p className="text-xl font-bold text-primary">
                              {relatorio.falta_para_meta === 0 ? 'Meta batida! 🎉' : brl(relatorio.falta_para_meta)}
                            </p>
                          </div>
                        </div>
                        <div className="relative mx-auto h-32 w-32">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[
                                  { name: 'Atingido', value: Math.min(relatorio.faturamento_mes, relatorio.meta_mensal) },
                                  { name: 'Falta', value: relatorio.falta_para_meta },
                                ]}
                                dataKey="value"
                                innerRadius={40}
                                outerRadius={60}
                                startAngle={90}
                                endAngle={-270}
                                isAnimationActive={false}
                              >
                                <Cell fill="#7c3aed" />
                                <Cell fill="#e5e7eb" />
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xl font-bold">
                            {relatorio.percentual_meta.toFixed(0)}%
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Defina uma meta mensal na aba{' '}
                        <a href="/dashboard/metas" className="text-primary hover:underline">Metas</a> pra acompanhar sua
                        distância até ela.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Detalhamento das vendas por faixa de valor</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <table className="w-full min-w-[440px] text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="px-2 py-2">Faixa</th>
                            <th className="px-2 py-2">Qtd</th>
                            <th className="px-2 py-2">% vendas</th>
                            <th className="px-2 py-2">Faturamento</th>
                            <th className="px-2 py-2">% faturamento</th>
                          </tr>
                        </thead>
                        <tbody>
                          {relatorio.faixas.map((f) => (
                            <tr key={f.tipo} className="border-b last:border-0">
                              <td className="px-2 py-2 font-medium" style={{ color: CORES_FAIXA[f.tipo] }}>
                                {rotuloFaixa(f)}
                              </td>
                              <td className="px-2 py-2">{f.quantidade}</td>
                              <td className="px-2 py-2">{f.percentualVendas.toFixed(0)}%</td>
                              <td className="px-2 py-2">{brl(f.faturamento)}</td>
                              <td className="px-2 py-2">{f.percentualFaturamento.toFixed(0)}%</td>
                            </tr>
                          ))}
                          <tr className="bg-muted font-bold">
                            <td className="px-2 py-2">Total</td>
                            <td className="px-2 py-2">{relatorio.vendas_realizadas}</td>
                            <td className="px-2 py-2">100%</td>
                            <td className="px-2 py-2">{brl(relatorio.faturamento_mes)}</td>
                            <td className="px-2 py-2">100%</td>
                          </tr>
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Distribuição do faturamento por faixa</CardTitle>
                    </CardHeader>
                    <CardContent className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={relatorio.faixas.map((f) => ({ name: rotuloFaixa(f), value: f.faturamento }))}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={50}
                            outerRadius={80}
                            isAnimationActive={false}
                            label={(d) => `${((d.percent ?? 0) * 100).toFixed(0)}%`}
                          >
                            {relatorio.faixas.map((f) => (
                              <Cell key={f.tipo} fill={CORES_FAIXA[f.tipo]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v) => brl(Number(v))} />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {relatorio.insights.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-amber-500" /> Análise e insights
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm">
                        {relatorio.insights.map((texto, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-primary">•</span> {texto}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {(relatorio.projecao_ticket_atual || relatorio.projecao_ticket_referencia) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Rocket className="h-5 w-5 text-primary" /> Projeção pra bater a meta
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                      {relatorio.projecao_ticket_atual && (
                        <div className="rounded-lg border p-4">
                          <p className="text-sm text-muted-foreground">
                            Mantendo o ticket médio atual ({brl(relatorio.ticket_medio_mes)})
                          </p>
                          <p className="mt-2 text-sm">
                            Você precisa vender aproximadamente{' '}
                            <strong className="text-lg text-primary">
                              {relatorio.projecao_ticket_atual.cestasNecessarias} cestas
                            </strong>
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Faltam cerca de <strong>{relatorio.projecao_ticket_atual.faltam} pedido(s)</strong> pra bater a
                            meta.
                          </p>
                        </div>
                      )}
                      {relatorio.projecao_ticket_referencia && (
                        <div className="rounded-lg border p-4">
                          <p className="text-sm text-muted-foreground">
                            Aumentando o ticket médio pra{' '}
                            {brl(relatorio.projecao_ticket_referencia.valorReferencia)} (referência da faixa mais alta)
                          </p>
                          <p className="mt-2 text-sm">
                            Você precisaria vender{' '}
                            <strong className="text-lg text-emerald-600">
                              {relatorio.projecao_ticket_referencia.cestasNecessarias} cestas
                            </strong>
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Reduz a necessidade pra apenas{' '}
                            <strong>{relatorio.projecao_ticket_referencia.faltam} pedido(s)</strong>.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="hoje" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Vendas Registradas</CardTitle>
                <CardDescription>Todas as transações de hoje</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {loading ? (
                    <p className="text-center py-8 text-muted-foreground">Carregando...</p>
                  ) : vendas.length > 0 ? (
                    vendas.map((venda) => (
                      <div
                        key={venda.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition"
                      >
                        <div className="flex-1">
                          <h4 className="font-semibold">{venda.cliente_nome}</h4>
                          <p className="text-sm text-muted-foreground">
                            {(venda.venda_itens || []).map((item) => item.produto_nome).join(', ') || 'Sem itens'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">R$ {venda.faturamento_total.toFixed(2)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">
                      Nenhuma venda registrada hoje
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="precificacao" className="mt-4">
            <PricingCalculator />
          </TabsContent>
        </Tabs>
      </PageShell>

      {showRegistroVendaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Registrar Venda</CardTitle>
              <CardDescription>Adicione o cliente e os itens vendidos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {formError && (
                <div className="p-3 bg-destructive/10 border border-destructive text-destructive rounded-lg text-sm">
                  {formError}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Cliente</label>
                <Input
                  placeholder="Apelido ou primeiro nome — evite dados completos"
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                />
              </div>

              {catalogo.length > 0 ? (
                <div className="space-y-4">
                  {(
                    [
                      { tipo: 'produto' as const, rotulo: 'Produtos' },
                      { tipo: 'adicional' as const, rotulo: 'Adicionais' },
                    ]
                  ).map(({ tipo, rotulo }) => {
                    const itens = catalogo.filter((p) => (p.tipo ?? 'produto') === tipo);
                    if (itens.length === 0) return null;
                    return (
                      <div key={tipo} className="space-y-2">
                        <label className="text-sm font-medium">{rotulo}</label>
                        <div className="flex flex-wrap gap-2">
                          {itens.map((produto) => (
                            <Button
                              key={produto.id}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => aplicarProduto(produto)}
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              {produto.name} · {brl(produto.price)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-xs text-muted-foreground">
                    Clique pra adicionar já preenchido, ou digite um item avulso abaixo.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Dica: cadastre seus produtos em{' '}
                  <Link href="/dashboard/produtos" className="text-primary hover:underline">
                    Meus produtos
                  </Link>{' '}
                  pra adicioná-los aqui com um clique.
                </p>
              )}

              <div className="space-y-3">
                <label className="text-sm font-medium">Itens</label>
                {itens.map((item, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <Input
                      placeholder="Item (ex: Caneca personalizada)"
                      value={item.produto_nome}
                      onChange={(e) => atualizarItem(index, 'produto_nome', e.target.value)}
                      className="flex-[2]"
                    />
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qtd"
                      value={item.quantidade}
                      onChange={(e) => atualizarItem(index, 'quantidade', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Preço"
                      value={item.preco_unitario}
                      onChange={(e) => atualizarItem(index, 'preco_unitario', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removerItem(index)}
                      disabled={itens.length === 1}
                      className="px-3"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={adicionarItem} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar item
                </Button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-xl font-bold">R$ {totalVenda.toFixed(2)}</span>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowRegistroVendaModal(false)}
                  disabled={salvando}
                >
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={registrarVenda} disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Registrar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
