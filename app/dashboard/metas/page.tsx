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
import { aplicarMascaraMoeda, formatarMoeda, parsearMoeda } from '@/lib/moeda';

/**
 * Valor que aparece já preenchido no campo quando ela vai definir a primeira
 * meta. É SUGESTÃO, nada mais.
 *
 * Antes ele também era usado como meta na falta de uma salva — e aí a tela
 * anunciava "META MENSAL R$ 10.000 · 31% atingido" pra quem nunca tinha
 * definido meta alguma. A aluna via um número inventado com cara de dado, e o
 * Dashboard (que só olha o que está salvo) dizia "defina uma meta", parecendo
 * que um dos dois estava quebrado. Quem estava errada era esta tela.
 */
const SUGESTAO_DE_META = 10000;

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
      // Number() porque coluna NUMERIC pode chegar como string, e aí toda
      // comparação e soma daqui pra frente passaria a ser de texto.
      for (const m of result.data || []) metas[m.mes] = Number(m.meta_mensal) || 0;
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
      return {
        nome,
        curto: nome.slice(0, 3),
        mes,
        // Zero quer dizer "não definida", e a tela precisa dizer isso em vez
        // de preencher o buraco com um número bonito.
        meta: metasSalvas[mes] || 0,
        faturamento: faturamentoPorMes[mes] || 0,
      };
    });
  }, [metasSalvas, faturamentoPorMes]);

  const atual = linhas[mesSelecionado - 1] ?? linhas[0] ?? {
    nome: '',
    curto: '',
    mes: mesSelecionado,
    meta: 0,
    faturamento: 0,
  };
  const temMeta = atual.meta > 0;
  const percentual = temMeta ? (atual.faturamento / atual.meta) * 100 : 0;
  const falta = Math.max(0, atual.meta - atual.faturamento);
  const mesesComMeta = linhas.filter((l) => l.meta > 0);
  const totalMeta = mesesComMeta.reduce((t, l) => t + l.meta, 0);
  const totalFat = linhas.reduce((t, l) => t + l.faturamento, 0);

  // O que o campo de meta virou de fato, pra mostrar na tela antes de gravar.
  const valorInterpretado = parsearMoeda(valor);

  // Mês que já passou. A API sempre aceitou meta retroativa — o upsert tem
  // chave (workspace, mês, ano) e nunca olhou o calendário. Só a tela não
  // dizia isso em lugar nenhum, então a Tania pediu como se fosse recurso que
  // faltava. Falta era o aviso, não a função.
  const mesJaEncerrado =
    ano < hojeData.getFullYear() ||
    (ano === hojeData.getFullYear() && mesSelecionado < hojeData.getMonth() + 1);

  const crescimento = (i: number) => {
    if (i === 0) return null;
    const anterior = linhas[i - 1]?.faturamento ?? 0;
    const atualFaturamento = linhas[i]?.faturamento ?? 0;
    if (anterior === 0) return atualFaturamento > 0 ? 100 : null;
    return ((atualFaturamento - anterior) / anterior) * 100;
  };

  const abrir = () => {
    setValor(aplicarMascaraMoeda(String(atual.meta || SUGESTAO_DE_META)));
    setErro('');
    setAberto(true);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    // parsearMoeda e não Number(): Number('100.000') devolve 100, que era
    // meia dúzia de zeros a menos na meta do mês.
    const n = parsearMoeda(valor);
    if (n === null) {
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
            <Pencil className="mr-2 h-4 w-4" /> Editar meta de {atual.nome}
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
                  <p className="text-2xl font-bold">{temMeta ? brl(atual.meta) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Faturamento até agora</p>
                  <p className="text-2xl font-bold">{brl(atual.faturamento)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">% atingido</p>
                  <p className="text-2xl font-bold">{temMeta ? `${percentual.toFixed(0)}%` : '—'}</p>
                </div>
              </div>

              {temMeta ? (
                <>
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
                </>
              ) : (
                /* Sem meta definida não há barra pra encher nem porcentagem
                   pra mostrar. Preencher esse buraco com um valor de exemplo
                   foi o que fez a tela anunciar "R$ 10.000 · 31% atingido" pra
                   quem nunca definiu meta nenhuma. */
                <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <p className="text-sm">
                    Você ainda não definiu a meta de <strong>{atual.nome.toLowerCase()}</strong>. Sem
                    ela não dá pra dizer quanto falta — e o Dashboard fica sem o acompanhamento.
                  </p>
                  <Button onClick={abrir}>
                    <Pencil className="mr-2 h-4 w-4" /> Definir a meta de {atual.nome}
                  </Button>
                </div>
              )}
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
                    const temMetaNoMes = l.meta > 0;
                    const pct = temMetaNoMes ? (l.faturamento / l.meta) * 100 : 0;
                    const cres = crescimento(i);
                    const bateu = temMetaNoMes && l.faturamento >= l.meta;
                    return (
                      <tr key={l.mes} className={cn('border-b last:border-0', l.mes === mesSelecionado && 'bg-accent/50')}>
                        <td className="px-4 py-3 font-medium">{l.nome}</td>
                        {/* Mês sem meta mostra travessão. Com o valor de
                            exemplo no lugar, a coluna inteira marcava "0%" em
                            vermelho contra uma meta que ninguém tinha posto. */}
                        <td className="px-4 py-3">
                          {temMetaNoMes ? brl(l.meta) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">{brl(l.faturamento)}</td>
                        <td
                          className={cn(
                            'px-4 py-3 font-bold',
                            !temMetaNoMes
                              ? 'text-muted-foreground'
                              : bateu
                                ? 'text-emerald-600'
                                : 'text-destructive',
                          )}
                        >
                          {temMetaNoMes ? `${pct.toFixed(0)}%` : '—'}
                        </td>
                        <td className={cn('px-4 py-3 font-semibold', cres === null ? 'text-muted-foreground' : cres >= 0 ? 'text-emerald-600' : 'text-destructive')}>
                          {cres === null ? '—' : `${cres >= 0 ? '+' : ''}${cres.toFixed(0)}%`}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-muted font-bold">
                    <td className="px-4 py-3">
                      Total
                      {/* Somar só os meses que têm meta e dizer quantos são:
                          senão o total parece o do ano inteiro. */}
                      {mesesComMeta.length > 0 && mesesComMeta.length < 12 && (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          ({mesesComMeta.length} {mesesComMeta.length === 1 ? 'mês' : 'meses'} com meta)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {totalMeta > 0 ? brl(totalMeta) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">{brl(totalFat)}</td>
                    <td className="px-4 py-3">
                      {totalMeta > 0 ? `${((totalFat / totalMeta) * 100).toFixed(0)}%` : '—'}
                    </td>
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
            {mesJaEncerrado && (
              <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                Mês já encerrado. Registrar a meta dele serve pra comparar com o
                que você faturou de verdade — o faturamento não muda.
              </p>
            )}
            {erro && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {erro}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="meta">Meta mensal (R$)</Label>
              {/*
                Campo de TEXTO, não type="number".

                Era <input type="number" step={100}> abrindo com 10.000, e o
                HTML valida o passo a partir do valor inicial: digitar 100.000
                caía fora da grade e o navegador "corrigia" pro múltiplo mais
                próximo — 99.700. Ela digitava cem mil, o sistema gravava
                noventa e nove mil e setecentos, calado.

                Sem step não há grade pra desalinhar, e a máscara mostra o
                agrupamento de milhar enquanto ela digita.
              */}
              <Input
                id="meta"
                inputMode="decimal"
                autoComplete="off"
                placeholder="100.000"
                value={valor}
                onChange={(e) => setValor(aplicarMascaraMoeda(e.target.value))}
              />
              {/* O valor interpretado, à vista antes de salvar. Se algum dia a
                  leitura errar de novo, ela vê aqui em vez de descobrir depois
                  no relatório. */}
              {valorInterpretado !== null && (
                <p className="text-xs text-muted-foreground">
                  Salvando <strong>{formatarMoeda(valorInterpretado)}</strong>
                </p>
              )}
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
