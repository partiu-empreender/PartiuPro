'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import PageShell from '@/components/shared/PageShell';
import PageHeader from '@/components/shared/PageHeader';

interface AlunaResumo {
  id: string;
  full_name: string;
  email: string;
  vendas_30d: number;
  faturamento_30d: number;
  ultima_venda_em: string | null;
}

const POLL_MS = 20000;

function diasDesde(dataIso: string | null): number | null {
  if (!dataIso) return null;
  return Math.floor((Date.now() - new Date(dataIso).getTime()) / (1000 * 60 * 60 * 24));
}

export default function AdminResumo() {
  const [alunas, setAlunas] = useState<AlunaResumo[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    try {
      const res = await fetch('/api/admin/resumo');
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao carregar resumo');
      setAlunas(result.data || []);
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
  const alunasAtivas = alunas.filter((a) => a.vendas_30d > 0).length;

  return (
    <PageShell>
      <PageHeader
        title="Painel Administrativo"
        description="Visão consolidada de todas as alunas — últimos 30 dias (atualiza automaticamente)"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Alunas cadastradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alunas.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Alunas ativas (com venda nos 30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alunasAtivas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Faturamento consolidado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {faturamentoTotal.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alunas</CardTitle>
          <CardDescription>Ordenado por faturamento nos últimos 30 dias — clique pra ver o detalhe</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : alunas.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Nenhuma aluna cadastrada ainda</p>
            ) : (
              alunas.map((aluna) => {
                const inativaHaDias = diasDesde(aluna.ultima_venda_em);
                const precisaAtencao = inativaHaDias === null || inativaHaDias > 7;

                return (
                  <Link
                    key={aluna.id}
                    href={`/admin/alunas/${aluna.id}`}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-white/60 bg-white/50 p-4 transition-colors hover:bg-accent"
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold">{aluna.full_name}</h4>
                      <p className="text-sm text-muted-foreground">{aluna.email}</p>
                      <p className="text-xs mt-1">
                        {inativaHaDias === null ? (
                          <span className="text-orange-600">Nenhuma venda registrada</span>
                        ) : precisaAtencao ? (
                          <span className="text-orange-600">Sem vender há {inativaHaDias} dia(s)</span>
                        ) : (
                          <span className="text-muted-foreground">Última venda há {inativaHaDias} dia(s)</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">R$ {aluna.faturamento_30d.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">{aluna.vendas_30d} venda(s)</p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
