'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import PageShell from '@/components/shared/PageShell';
import PageHeader from '@/components/shared/PageHeader';

const META_PADRAO = 10000;

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export default function MetasPage() {
  const hojeData = new Date();
  const [ano, setAno] = useState(hojeData.getFullYear());
  const [mesSelecionado, setMesSelecionado] = useState(hojeData.getMonth() + 1);
  const [metasSalvas, setMetasSalvas] = useState<Record<number, number>>({});
  const [faturamentoPorMes, setFaturamentoPorMes] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = async (anoAlvo: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/metas?ano=${anoAlvo}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao carregar metas');
      const metas: Record<number, number> = {};
      for (const m of result.data || []) metas[m.mes] = m.meta_mensal;
      setMetasSalvas(metas);
      setFaturamentoPorMes(result.faturamentoPorMes || {});
    } catch (error) {
      console.error('Erro ao carregar metas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar(ano);
  }, [ano]);

  const linhas = useMemo(() => {
    return MESES.map((nome, i) => {
      const mes = i + 1;
      const metaSalva = metasSalvas[mes] || 0;
      return {
        nome,
        curto: nome.slice(0, 3),
        mes,
        metaSalva,
        meta: metaSalva > 0 ? metaSalva : META_PADRAO,
        faturamento: faturamentoPorMes[mes] || 0,
      };
    });
  }, [metasSalvas, faturamentoPorMes]);

  const atual = linhas[mesSelecionado - 1] ?? linhas[0] ?? {
    nome: '',
    curto: '',
    mes: mesSelecionado,
    metaSalva: 0,
    meta: META_PADRAO,
    faturamento: 0,
  };
  const percentual = atual.meta > 0 ? (atual.faturamento / atual.meta) * 100 : 0;
  const falta = Math.max(0, atual.meta - atual.faturamento);
  const totalMeta = linhas.reduce((t, l) => t + l.meta, 0);
  const totalFat = linhas.reduce((t, l) => t + l.faturamento, 0);

  const crescimento = (i: number) => {
    if (i === 0) return null;
    const anterior = linhas[i - 1]?.faturamento ?? 0;
    const atualFaturamento = linhas[i]?.faturamento ?? 0;
    if (anterior === 0) return atualFaturamento > 0 ? 100 : null;
    return ((atualFaturamento - anterior) / anterior) * 100;
  };

  const abrir = () => {
    setValor(String(atual.metaSalva || META_PADRAO));
    setErro('');
    setAberto(true);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    const n = Number(valor);
    if (!Number.isFinite(n) || n < 0) {
      setErro('Informe um valor numérico válido.');
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch('/api/metas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes: mesSelecionado, ano, meta_mensal: n }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao salvar meta');
      setAberto(false);
      await carregar(ano);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao salvar meta');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Metas"
        description={`Planejamento anual de ${ano}`}
        action={
          <Button size="lg" onClick={abrir}>
            <Pencil className="mr-2 h-4 w-4" /> Editar meta
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Ano anterior" onClick={() => setAno((a) => a - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-1 gap-1 overflow-x-auto">
          {linhas.map((l) => (
            <button
              key={l.mes}
              type="button"
              onClick={() => setMesSelecionado(l.mes)}
              className={cn(
                'shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                l.mes === mesSelecionado
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-white/60 bg-white/60 text-muted-foreground backdrop-blur-md hover:bg-accent',
              )}
            >
              {l.curto}
            </button>
          ))}
        </div>
        <Button variant="outline" size="icon" aria-label="Próximo ano" onClick={() => setAno((a) => a + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <p className="text-center py-8 text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <Card>
            <CardContent className="space-y-5 p-7 sm:p-8">
              <h2 className="text-3xl font-black uppercase">{atual.nome} {ano}</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Meta mensal</p>
                  <p className="text-2xl font-bold">{brl(atual.meta)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Faturamento até agora</p>
                  <p className="text-2xl font-bold">{brl(atual.faturamento)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">% atingido</p>
                  <p className="text-2xl font-bold">{percentual.toFixed(0)}%</p>
                </div>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, percentual)}%` }}
                />
              </div>
              <p className="text-sm font-semibold text-muted-foreground">
                {falta === 0 ? (
                  <span className="text-primary">Meta batida! 🎉</span>
                ) : (
                  <>Falta para bater a meta: <strong>{brl(falta)}</strong></>
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comparativo anual {ano}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0 sm:px-7 sm:pb-7">
              <table className="w-full min-w-[540px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Mês</th>
                    <th className="px-4 py-3">Meta</th>
                    <th className="px-4 py-3">Faturamento</th>
                    <th className="px-4 py-3">% atingido</th>
                    <th className="px-4 py-3">Crescimento</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => {
                    const pct = l.meta > 0 ? (l.faturamento / l.meta) * 100 : 0;
                    const cres = crescimento(i);
                    const bateu = l.faturamento >= l.meta;
                    return (
                      <tr key={l.mes} className={cn('border-b last:border-0', l.mes === mesSelecionado && 'bg-accent/50')}>
                        <td className="px-4 py-3 font-medium">{l.nome}</td>
                        <td className="px-4 py-3">{brl(l.meta)}</td>
                        <td className="px-4 py-3">{brl(l.faturamento)}</td>
                        <td className={cn('px-4 py-3 font-bold', bateu ? 'text-emerald-600' : 'text-destructive')}>
                          {pct.toFixed(0)}%
                        </td>
                        <td className={cn('px-4 py-3 font-semibold', cres === null ? 'text-muted-foreground' : cres >= 0 ? 'text-emerald-600' : 'text-destructive')}>
                          {cres === null ? '—' : `${cres >= 0 ? '+' : ''}${cres.toFixed(0)}%`}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-muted font-bold">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3">{brl(totalMeta)}</td>
                    <td className="px-4 py-3">{brl(totalFat)}</td>
                    <td className="px-4 py-3">{totalMeta > 0 ? ((totalFat / totalMeta) * 100).toFixed(0) : 0}%</td>
                    <td className="px-4 py-3">—</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evolução do faturamento</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={linhas} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="curto" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} tickLine={false} axisLine={false} fontSize={12} width={40} />
                  <Tooltip formatter={(v) => brl(Number(v))} />
                  <Line type="monotone" dataKey="faturamento" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Meta de {atual.nome} {ano}</DialogTitle>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            {erro && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {erro}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="meta">Meta mensal (R$)</Label>
              <Input
                id="meta"
                type="number"
                min={0}
                step={100}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
