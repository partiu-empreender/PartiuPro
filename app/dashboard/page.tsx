'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  ShoppingBag,
  Users,
  TrendingUp,
  Package,
  Plus,
  Calendar,
  DollarSign,
} from 'lucide-react';

interface MetricasVendas {
  atendimentos: number; // Número de CLIENTES que receberam atendimento
  vendas: number; // Número de TRANSAÇÕES (1 cliente = 1 venda, múltiplos produtos)
  pa: number; // Produtos por Atendimento (faturamento_total / quantidade_itens)
  faturamento_total: number;
  ticket_medio: number;
}

interface VendaDiaria {
  id: string;
  data: string;
  cliente_nome: string;
  faturamento_total: number;
  status: string;
  venda_itens_count: number;
}

export default function DashboardPage() {
  const [metricas, setMetricas] = useState<MetricasVendas>({
    atendimentos: 0,
    vendas: 0,
    pa: 0,
    faturamento_total: 0,
    ticket_medio: 0,
  });

  const [vendas, setVendas] = useState<VendaDiaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('metricas');
  const [showRegistroVendaModal, setShowRegistroVendaModal] = useState(false);

  // Carrega as métricas do dia
  const carregarMetricas = async () => {
    try {
      setLoading(true);

      // ============================================
      // LÓGICA CORRIGIDA: Vendas vs Atendimentos
      // ============================================
      // Atendimentos = número de clientes distintos que tiveram interação
      // Vendas = número de transações (vendas_diarias)
      // PA = Produtos por Atendimento = quantidade_total_itens / número_transações

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // Busca as vendas do dia
      const hoje = new Date().toISOString().split('T')[0];

      const { data: vendasData, error: vendasError } = await supabase
        .from('vendas_diarias')
        .select(
          `
          id,
          data,
          cliente_nome,
          faturamento_total,
          status,
          venda_itens (
            id,
            quantidade
          )
        `
        )
        .eq('workspace_id', user.user.id)
        .eq('data', hoje);

      if (vendasError) throw vendasError;

      // ============================================
      // CÁLCULOS CORRIGIDOS
      // ============================================

      // Número de CLIENTES (Atendimentos)
      // = número de registros distintos em vendas_diarias
      const atendimentos = vendasData?.length || 0;

      // Número de TRANSAÇÕES (Vendas)
      // = número de registros em vendas_diarias
      const vendas = vendasData?.length || 0;

      // Quantidade total de itens
      const totalItens = vendasData?.reduce((sum, venda) => {
        return sum + (venda.venda_itens?.reduce((itemSum, item) => itemSum + item.quantidade, 0) || 0);
      }, 0) || 0;

      // PA (Produtos por Atendimento)
      // = quantidade_total_itens / número_de_transações
      // Exemplo: 5 clientes, 20 produtos no total = 20 / 5 = 4 produtos por atendimento
      const pa = vendas > 0 ? (totalItens / vendas).toFixed(2) : 0;

      // Faturamento total
      const faturamento = vendasData?.reduce((sum, venda) => sum + (venda.faturamento_total || 0), 0) || 0;

      // Ticket médio = Faturamento / Número de vendas
      const ticketMedio = vendas > 0 ? (faturamento / vendas).toFixed(2) : 0;

      setMetricas({
        atendimentos,
        vendas,
        pa: parseFloat(pa as string),
        faturamento_total: faturamento,
        ticket_medio: parseFloat(ticketMedio as string),
      });

      // Formata dados para exibição
      const vendasFormatadas: VendaDiaria[] = vendasData?.map((venda) => ({
        id: venda.id,
        data: venda.data,
        cliente_nome: venda.cliente_nome || 'Sem nome',
        faturamento_total: venda.faturamento_total,
        status: venda.status,
        venda_itens_count: venda.venda_itens?.length || 0,
      })) || [];

      setVendas(vendasFormatadas);
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarMetricas();
    // Recarrega a cada 30 segundos
    const interval = setInterval(carregarMetricas, 30000);
    return () => clearInterval(interval);
  }, []);

  const metricasCards = [
    {
      title: 'Atendimentos',
      value: metricas.atendimentos,
      description: 'Clientes atendidos',
      icon: Users,
      color: 'text-blue-600',
    },
    {
      title: 'Vendas',
      value: metricas.vendas,
      description: 'Transações realizadas',
      icon: ShoppingBag,
      color: 'text-green-600',
    },
    {
      title: 'PA (Produtos/Atendimento)',
      value: metricas.pa.toFixed(2),
      description: 'Média de produtos por transação',
      icon: Package,
      color: 'text-purple-600',
    },
    {
      title: 'Ticket Médio',
      value: `R$ ${metricas.ticket_medio.toFixed(2)}`,
      description: 'Valor médio por venda',
      icon: DollarSign,
      color: 'text-orange-600',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard de Vendas</h1>
            <p className="mt-2 text-muted-foreground">
              Visão geral do seu negócio em tempo real
            </p>
          </div>
          <Button
            onClick={() => setShowRegistroVendaModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Registrar Venda
          </Button>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {metricasCards.map((metrica, index) => {
            const Icon = metrica.icon;
            return (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{metrica.title}</CardTitle>
                  <Icon className={`h-4 w-4 ${metrica.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrica.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metrica.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="metricas">Métricas</TabsTrigger>
            <TabsTrigger value="vendas">Vendas do Dia</TabsTrigger>
            <TabsTrigger value="precificacao">Precificação</TabsTrigger>
            <TabsTrigger value="custos">Custos</TabsTrigger>
            <TabsTrigger value="lucro">Lucro</TabsTrigger>
          </TabsList>

          {/* TAB 1: Métricas */}
          <TabsContent value="metricas" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Faturamento por Hora</CardTitle>
                  <CardDescription>Evolução ao longo do dia</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={[]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="faturamento" stroke="#8b5cf6" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Comparativo Métricas</CardTitle>
                  <CardDescription>Atendimentos vs Vendas</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={[
                      {
                        name: 'Hoje',
                        atendimentos: metricas.atendimentos,
                        vendas: metricas.vendas,
                      },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="atendimentos" fill="#3b82f6" />
                      <Bar dataKey="vendas" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Informações Adicionais</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Faturamento Total</p>
                  <p className="text-2xl font-bold">R$ {metricas.faturamento_total.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                  <p className="text-2xl font-bold">
                    {metricas.atendimentos > 0
                      ? ((metricas.vendas / metricas.atendimentos) * 100).toFixed(1)
                      : 0}
                    %
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: Vendas do Dia */}
          <TabsContent value="vendas" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Vendas Registradas</CardTitle>
                <CardDescription>Todas as transações de hoje</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {vendas.length > 0 ? (
                    vendas.map((venda) => (
                      <div
                        key={venda.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition"
                      >
                        <div className="flex-1">
                          <h4 className="font-semibold">{venda.cliente_nome}</h4>
                          <p className="text-sm text-muted-foreground">
                            {venda.venda_itens_count} produto(s) - Status: {venda.status}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">
                            R$ {venda.faturamento_total.toFixed(2)}
                          </p>
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

          {/* TAB 3: Precificação */}
          <TabsContent value="precificacao" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Calculadora de Margem</CardTitle>
                  <CardDescription>Estratégias de Precificação</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {[
                      { margin: '80%', color: 'bg-blue-50 border-blue-200' },
                      { margin: '90%', color: 'bg-green-50 border-green-200', recommended: true },
                      { margin: '100%', color: 'bg-purple-50 border-purple-200' },
                      { margin: '120%', color: 'bg-orange-50 border-orange-200' },
                    ].map((item, idx) => (
                      <button
                        key={idx}
                        className={`w-full p-3 border rounded-lg text-left transition hover:shadow-md ${item.color}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{item.margin} de Margem</span>
                          {item.recommended && (
                            <span className="text-xs bg-green-200 text-green-800 px-2 py-1 rounded">
                              Recomendado
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Componentes do Preço</CardTitle>
                  <CardDescription>Custo Direto → Preço Final</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Custo Direto</label>
                    <p className="text-2xl font-bold text-blue-600">R$ 75,16</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Despesas Fixas (25%)</label>
                    <p className="text-lg text-gray-600">R$ 18,79</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Margem de Lucro (90%)</label>
                    <p className="text-lg text-green-600">R$ 85,05</p>
                  </div>
                  <div className="pt-4 border-t">
                    <label className="text-sm font-medium">Preço Final Sugerido</label>
                    <p className="text-3xl font-bold text-green-700">R$ 179,00</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 4: Custos */}
          <TabsContent value="custos" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Análise de Custos</CardTitle>
                <CardDescription>Breakdown de custos operacionais</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <span>Custo Total de Produção</span>
                    <span className="font-bold">R$ 0,00</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <span>Despesas Fixas (aluguel, etc)</span>
                    <span className="font-bold">R$ 0,00</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                    <span className="font-semibold">Custo Total do Dia</span>
                    <span className="font-bold text-red-600">R$ 0,00</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 5: Lucro */}
          <TabsContent value="lucro" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Análise de Lucro</CardTitle>
                <CardDescription>Rentabilidade do dia</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-muted-foreground">Faturamento</p>
                    <p className="text-2xl font-bold text-blue-600">
                      R$ {metricas.faturamento_total.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-muted-foreground">Custos</p>
                    <p className="text-2xl font-bold text-red-600">R$ 0,00</p>
                  </div>
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-muted-foreground">Lucro Líquido</p>
                    <p className="text-2xl font-bold text-green-600">
                      R$ {metricas.faturamento_total.toFixed(2)}
                    </p>
                  </div>
                </div>

                <Card className="border-2 border-green-200">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-2">
                        Margem de Lucro Hoje
                      </p>
                      <p className="text-4xl font-bold text-green-600">
                        0%
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Adicione custos para calcular a margem real
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal Registrar Venda */}
      {showRegistroVendaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Registrar Venda</CardTitle>
              <CardDescription>Adicione uma nova transação</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Modal de registro de venda será implementado aqui.
              </p>
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => setShowRegistroVendaModal(false)}
              >
                Cancelar
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
