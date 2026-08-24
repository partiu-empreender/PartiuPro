'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PricingCalculator from '@/components/PricingCalculator';
import {
  ShoppingBag,
  Package,
  Plus,
  DollarSign,
  CalendarDays,
  Trash2,
} from 'lucide-react';

interface MetricasVendas {
  vendas: number; // Número de TRANSAÇÕES (1 cliente = 1 venda, múltiplos itens)
  pa: number; // Produtos por Atendimento (quantidade de itens / número de vendas)
  faturamento_total: number;
  ticket_medio: number;
  faturamento_mes: number;
}

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

interface NovoItemForm {
  produto_nome: string;
  quantidade: string;
  preco_unitario: string;
}

const itemVazio = (): NovoItemForm => ({ produto_nome: '', quantidade: '1', preco_unitario: '' });

export default function DashboardPage() {
  const [metricas, setMetricas] = useState<MetricasVendas>({
    vendas: 0,
    pa: 0,
    faturamento_total: 0,
    ticket_medio: 0,
    faturamento_mes: 0,
  });

  const [vendas, setVendas] = useState<VendaDiaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('metricas');
  const [showRegistroVendaModal, setShowRegistroVendaModal] = useState(false);

  // Form de registro de venda
  const [clienteNome, setClienteNome] = useState('');
  const [itens, setItens] = useState<NovoItemForm[]>([itemVazio()]);
  const [salvando, setSalvando] = useState(false);
  const [formError, setFormError] = useState('');

  const carregarMetricas = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/vendas');
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'Erro ao carregar vendas');

      setMetricas(result.metricas);
      setVendas(result.vendas || []);
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    } finally {
      setLoading(false);
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
    setItens((atual) => atual.map((item, i) => (i === index ? { ...item, [campo]: valor } : item)));
  };

  const adicionarItem = () => setItens((atual) => [...atual, itemVazio()]);
  const removerItem = (index: number) => setItens((atual) => atual.filter((_, i) => i !== index));

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

  const metricasCards = [
    {
      title: 'Vendas',
      value: metricas.vendas,
      description: 'Transações realizadas hoje',
      icon: ShoppingBag,
      color: 'text-green-600',
    },
    {
      title: 'PA (Produtos/Atendimento)',
      value: metricas.pa.toFixed(2),
      description: 'Média de itens por venda',
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
    {
      title: 'Faturamento do Mês',
      value: `R$ ${metricas.faturamento_mes.toFixed(2)}`,
      description: 'Soma de todas as vendas do mês atual',
      icon: CalendarDays,
      color: 'text-blue-600',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard de Vendas</h1>
            <p className="mt-2 text-muted-foreground">
              Visão geral do seu negócio em tempo real
            </p>
          </div>
          <Button onClick={abrirModal} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Registrar Venda
          </Button>
        </div>

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
                  <p className="text-xs text-muted-foreground mt-1">{metrica.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="metricas">Vendas do Dia</TabsTrigger>
            <TabsTrigger value="precificacao">Precificação</TabsTrigger>
          </TabsList>

          <TabsContent value="metricas" className="space-y-4 mt-4">
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
      </div>

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
                  placeholder="Nome do cliente"
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                />
              </div>

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
    </div>
  );
}
