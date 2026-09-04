'use client';

/**
 * Histórico — o ano inteiro, mês a mês, com os números do dashboard.
 *
 * Existe porque o sistema não pode começar a existir no dia em que a aluna
 * instalou. Ela chega com uma planilha de meses (às vezes anos) de
 * faturamento, e digitar venda por venda pra alimentar isso é inviável: ela
 * não tem mais o nome da cliente nem o item de cada uma. O que ela tem é o
 * total do mês, e é o total que esta tela recebe.
 *
 * O mês corrente NÃO é editável aqui, de propósito — ele já é calculado ao
 * vivo pelo Dashboard, que é a tela que ela abre todo dia. Ver lib/fechamento.ts.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Pencil, PenLine, AlertTriangle, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import PageShell from '@/components/shared/PageShell';
import PageHeader from '@/components/shared/PageHeader';
import { aplicarMascaraMoeda, formatarMoeda, parsearMoeda } from '@/lib/moeda';
import { MESES, partesHojeBrasil } from '@/lib/datas';
import { motivoFechamentoInvalido, type FechamentoManual, type NumerosDoMes } from '@/lib/fechamento';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCurto = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/** Travessão, e não "0": número que ela não informou não é zero. */
const ouTraco = (valor: number | null, formatar: (n: number) => string) =>
  valor === null ? '—' : formatar(valor);

interface MesDoHistorico extends NumerosDoMes {
  meta: number;
  manual: FechamentoManual | null;
}

/** Os campos do formulário, todos como texto — quem interpreta é parsearMoeda. */
interface FormFechamento {
  faturamento: string;
  vendas: string;
  produtos_vendidos: string;
  atendimentos: string;
  ticket_medio: string;
  conversao: string;
  observacao: string;
}

const formVazio = (): FormFechamento => ({
  faturamento: '',
  vendas: '',
  produtos_vendidos: '',
  atendimentos: '',
  ticket_medio: '',
  conversao: '',
  observacao: '',
});

const textoOuVazio = (v: number | null | undefined) =>
  v === null || v === undefined ? '' : String(v);

export default function HistoricoPage() {
  const hoje = partesHojeBrasil();
  const [ano, setAno] = useState(hoje.ano);
  const [mesSelecionado, setMesSelecionado] = useState(
    // Abre no mês passado: é o que ela veio preencher. O corrente já está no
    // Dashboard, e é o único que esta tela não deixa editar.
    hoje.mes === 1 ? 12 : hoje.mes - 1,
  );
  const [meses, setMeses] = useState<MesDoHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroCarga, setErroCarga] = useState('');

  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<FormFechamento>(formVazio());
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [descartando, setDescartando] = useState(false);

  const carregar = async (anoAlvo: number) => {
    try {
      setLoading(true);
      setErroCarga('');
      const res = await fetch(`/api/fechamentos?ano=${anoAlvo}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao carregar o histórico');
      setMeses(result.meses || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      setErroCarga(error instanceof Error ? error.message : 'Erro ao carregar o histórico');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar(ano);
  }, [ano]);

  const atual = meses[mesSelecionado - 1] ?? null;

  const totais = useMemo(() => {
    const comDado = meses.filter((m) => m.fonte !== 'vazio');
    const faturamento = comDado.reduce((t, m) => t + m.faturamento, 0);
    const vendas = comDado.reduce((t, m) => t + m.vendas, 0);
    const atendimentos = comDado.reduce((t, m) => t + m.atendimentos, 0);
    return {
      mesesComDado: comDado.length,
      faturamento,
      vendas,
      atendimentos,
      ticket: vendas > 0 ? faturamento / vendas : null,
      conversao: atendimentos > 0 ? (vendas / atendimentos) * 100 : null,
    };
  }, [meses]);

  const abrir = () => {
    if (!atual) return;
    const m = atual.manual;
    setForm({
      faturamento: m?.faturamento != null ? aplicarMascaraMoeda(String(m.faturamento)) : '',
      vendas: textoOuVazio(m?.vendas),
      produtos_vendidos: textoOuVazio(m?.produtos_vendidos),
      atendimentos: textoOuVazio(m?.atendimentos),
      ticket_medio: m?.ticket_medio != null ? aplicarMascaraMoeda(String(m.ticket_medio)) : '',
      conversao: textoOuVazio(m?.conversao),
      observacao: m?.observacao ?? '',
    });
    setErro('');
    setAberto(true);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    // A MESMA validação da rota, pra tela e servidor não discordarem.
    const motivo = motivoFechamentoInvalido(mesSelecionado, ano, hoje);
    if (motivo) {
      setErro(motivo);
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch('/api/fechamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes: mesSelecionado, ano, ...form }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao salvar o fechamento');
      setAberto(false);
      await carregar(ano);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao salvar o fechamento');
    } finally {
      setSalvando(false);
    }
  };

  /** Saída do aviso de divergência: volta a usar as vendas lançadas. */
  const descartarFechamento = async () => {
    setDescartando(true);
    try {
      const res = await fetch(`/api/fechamentos?mes=${mesSelecionado}&ano=${ano}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Erro ao descartar');
      }
      setAberto(false);
      await carregar(ano);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao descartar o fechamento');
    } finally {
      setDescartando(false);
    }
  };

  const atualizarCampo = (campo: keyof FormFechamento, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const nomeDoMes = MESES[mesSelecionado - 1] ?? '';

  return (
    <PageShell>
      <PageHeader
        title="Histórico"
        description={`Seus números mês a mês em ${ano}`}
        action={
          atual && !atual.ehMesCorrenteOuFuturo ? (
            <Button size="lg" onClick={abrir}>
              <Pencil className="mr-2 h-4 w-4" />
              {atual.fonte === 'manual' ? 'Editar' : 'Preencher'} {nomeDoMes}
            </Button>
          ) : undefined
        }
      />

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Ano anterior" onClick={() => setAno((a) => a - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-1 gap-1 overflow-x-auto">
          {MESES.map((nome, i) => {
            const mes = i + 1;
            const dados = meses[i];
            return (
              <button
                key={mes}
                type="button"
                onClick={() => setMesSelecionado(mes)}
                className={cn(
                  'relative shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                  mes === mesSelecionado
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-white/60 bg-white/60 text-muted-foreground backdrop-blur-md hover:bg-accent',
                )}
              >
                {nome.slice(0, 3)}
                {/* Pontinho no mês preenchido à mão: ela precisa bater o olho
                    no ano e ver o que já cadastrou sem abrir mês por mês. */}
                {dados?.fonte === 'manual' && (
                  <span
                    aria-label="preenchido à mão"
                    className={cn(
                      'absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full',
                      mes === mesSelecionado ? 'bg-primary-foreground' : 'bg-primary',
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
        <Button variant="outline" size="icon" aria-label="Próximo ano" onClick={() => setAno((a) => a + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-muted-foreground">Carregando...</p>
      ) : erroCarga ? (
        <div className="rounded-2xl border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {erroCarga}
        </div>
      ) : (
        <>
          {atual && (
            <Card>
              <CardHeader className="gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <CardTitle className="text-3xl font-black uppercase">
                    {nomeDoMes} {ano}
                  </CardTitle>
                  {atual.fonte === 'manual' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      <PenLine className="h-3 w-3" /> Preenchido à mão
                    </span>
                  )}
                </div>
                {atual.ehMesCorrenteOuFuturo ? (
                  <CardDescription>
                    {mesSelecionado === hoje.mes && ano === hoje.ano ? (
                      <>
                        Mês em andamento — estes números vêm das vendas que você registra e mudam
                        sozinhos. O relatório completo está no{' '}
                        <Link href="/dashboard" className="text-primary hover:underline">
                          Dashboard
                        </Link>
                        .
                      </>
                    ) : (
                      'Mês que ainda não começou.'
                    )}
                  </CardDescription>
                ) : atual.fonte === 'vendas' ? (
                  <CardDescription>Calculado pelas vendas que você registrou neste mês.</CardDescription>
                ) : atual.fonte === 'vazio' ? (
                  <CardDescription>
                    Nenhuma venda registrada e nada preenchido à mão ainda.
                  </CardDescription>
                ) : null}
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  {[
                    { rotulo: 'Faturamento', valor: brl(atual.faturamento) },
                    { rotulo: 'Vendas', valor: String(atual.vendas) },
                    { rotulo: 'Produtos vendidos', valor: String(atual.produtos_vendidos) },
                    { rotulo: 'Ticket médio', valor: ouTraco(atual.ticket_medio, brl) },
                    { rotulo: 'Atendimentos', valor: String(atual.atendimentos) },
                    {
                      rotulo: 'Conversão',
                      valor: ouTraco(atual.conversao, (n) => `${n.toFixed(1)}%`),
                    },
                  ].map((c) => (
                    <div key={c.rotulo} className="rounded-2xl border border-white/60 bg-white/50 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.rotulo}</p>
                      <p className="mt-1 text-2xl font-bold leading-none">{c.valor}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Meta do mês</p>
                    <p className="text-xl font-bold">
                      {atual.meta > 0 ? brl(atual.meta) : <span className="text-muted-foreground">—</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">% da meta</p>
                    <p className="text-xl font-bold">
                      {atual.meta > 0 ? `${((atual.faturamento / atual.meta) * 100).toFixed(0)}%` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Produtos por atendimento
                    </p>
                    <p className="text-xl font-bold">{ouTraco(atual.pa, (n) => n.toFixed(2))}</p>
                  </div>
                </div>

                {atual.meta === 0 && !atual.ehMesCorrenteOuFuturo && (
                  <p className="text-sm text-muted-foreground">
                    Sem meta definida para {nomeDoMes.toLowerCase()}. Você pode registrar a meta
                    retroativa em{' '}
                    <Link href="/dashboard/metas" className="text-primary hover:underline">
                      Metas
                    </Link>{' '}
                    pra comparar com o que faturou de verdade.
                  </p>
                )}

                {/* O aviso que impede o número digitado de esconder venda real.
                    Vencer em silêncio seria o problema; vencer avisando é a
                    escolha dela — e aqui está o botão de desfazer. */}
                {atual.divergencia && (
                  <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-semibold text-amber-900">
                        Este mês está usando o valor que você preencheu à mão.
                      </p>
                      <p className="text-sm text-amber-900">
                        Há {atual.divergencia.vendasLancadas} venda(s) registrada(s) em{' '}
                        {nomeDoMes.toLowerCase()} somando{' '}
                        <strong>{brl(atual.divergencia.faturamentoDasVendas)}</strong>, que não estão
                        sendo contadas — o mês aparece como{' '}
                        <strong>{brl(atual.divergencia.faturamentoManual)}</strong>.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={descartarFechamento}
                      disabled={descartando}
                    >
                      <Undo2 className="mr-2 h-4 w-4" />
                      {descartando ? 'Descartando...' : 'Usar as vendas'}
                    </Button>
                  </div>
                )}

                {atual.manual?.observacao && (
                  <p className="rounded-xl border border-white/60 bg-white/40 p-3 text-sm text-muted-foreground">
                    <strong className="font-medium text-foreground">Observação:</strong>{' '}
                    {atual.manual.observacao}
                  </p>
                )}

                {atual.fonte === 'vazio' && !atual.ehMesCorrenteOuFuturo && (
                  <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
                    <p className="text-sm">
                      Você não tem nada registrado em <strong>{nomeDoMes.toLowerCase()}</strong>. Se
                      esse mês existiu no seu caderno ou na sua planilha, preencha os números aqui —
                      eles entram no histórico e nos comparativos do ano.
                    </p>
                    <Button onClick={abrir}>
                      <Pencil className="mr-2 h-4 w-4" /> Preencher {nomeDoMes}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Ano de {ano}</CardTitle>
              <CardDescription>
                Meses com <PenLine className="inline h-3 w-3 text-primary" /> foram preenchidos à
                mão; os demais são calculados pelas vendas registradas.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0 sm:px-7 sm:pb-7">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-3">Mês</th>
                    <th className="px-3 py-3">Faturamento</th>
                    <th className="px-3 py-3">Meta</th>
                    <th className="px-3 py-3">Vendas</th>
                    <th className="px-3 py-3">Ticket médio</th>
                    <th className="px-3 py-3">Atend.</th>
                    <th className="px-3 py-3">Conversão</th>
                    <th className="px-3 py-3">PA</th>
                  </tr>
                </thead>
                <tbody>
                  {meses.map((m) => (
                    <tr
                      key={m.mes}
                      onClick={() => setMesSelecionado(m.mes)}
                      className={cn(
                        'cursor-pointer border-b last:border-0 hover:bg-accent/40',
                        m.mes === mesSelecionado && 'bg-accent/50',
                      )}
                    >
                      <td className="px-3 py-3 font-medium">
                        <span className="flex items-center gap-1.5">
                          {MESES[m.mes - 1]}
                          {m.fonte === 'manual' && (
                            <PenLine className="h-3 w-3 text-primary" aria-label="preenchido à mão" />
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {m.fonte === 'vazio' ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          brl(m.faturamento)
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {m.meta > 0 ? brlCurto(m.meta) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-3">{m.fonte === 'vazio' ? '—' : m.vendas}</td>
                      <td className="px-3 py-3">{ouTraco(m.ticket_medio, brl)}</td>
                      <td className="px-3 py-3">{m.fonte === 'vazio' ? '—' : m.atendimentos}</td>
                      <td className="px-3 py-3">
                        {ouTraco(m.conversao, (n) => `${n.toFixed(1)}%`)}
                      </td>
                      <td className="px-3 py-3">{ouTraco(m.pa, (n) => n.toFixed(2))}</td>
                    </tr>
                  ))}
                  <tr className="bg-muted font-bold">
                    <td className="px-3 py-3">
                      Total
                      {totais.mesesComDado > 0 && totais.mesesComDado < 12 && (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          ({totais.mesesComDado} {totais.mesesComDado === 1 ? 'mês' : 'meses'})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">{brl(totais.faturamento)}</td>
                    <td className="px-3 py-3">—</td>
                    <td className="px-3 py-3">{totais.vendas}</td>
                    <td className="px-3 py-3">{ouTraco(totais.ticket, brl)}</td>
                    <td className="px-3 py-3">{totais.atendimentos}</td>
                    <td className="px-3 py-3">
                      {ouTraco(totais.conversao, (n) => `${n.toFixed(1)}%`)}
                    </td>
                    <td className="px-3 py-3">—</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Faturamento x meta</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={meses.map((m) => ({
                    curto: MESES[m.mes - 1]?.slice(0, 3) ?? '',
                    Faturamento: m.faturamento,
                    Meta: m.meta,
                  }))}
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="curto" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis
                    tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    width={44}
                  />
                  <Tooltip formatter={(v) => brl(Number(v))} />
                  <Legend />
                  <Bar dataKey="Faturamento" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Meta" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {nomeDoMes} {ano}
            </DialogTitle>
            <DialogDescription>
              Preencha só o que você souber. O que ficar em branco aparece como &quot;—&quot;, e não
              como zero.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={salvar} className="space-y-4">
            {erro && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {erro}
              </div>
            )}

            {atual?.divergencia && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Há {atual.divergencia.vendasLancadas} venda(s) registrada(s) neste mês somando{' '}
                {brl(atual.divergencia.faturamentoDasVendas)}. O que você salvar aqui substitui esse
                valor na tela.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="faturamento">Faturamento do mês (R$)</Label>
                {/* Campo de TEXTO com máscara, como o de meta: <input
                    type="number"> com step "corrigia" 100.000 pra 99.700 sem
                    avisar. Ver lib/moeda.ts. */}
                <Input
                  id="faturamento"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="38.400"
                  value={form.faturamento}
                  onChange={(e) => atualizarCampo('faturamento', aplicarMascaraMoeda(e.target.value))}
                />
                {parsearMoeda(form.faturamento) !== null && (
                  <p className="text-xs text-muted-foreground">
                    Salvando <strong>{formatarMoeda(parsearMoeda(form.faturamento) as number)}</strong>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendas">Quantas vendas</Label>
                <Input
                  id="vendas"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="62"
                  value={form.vendas}
                  onChange={(e) => atualizarCampo('vendas', e.target.value.replace(/\D/g, ''))}
                />
                <p className="text-xs text-muted-foreground">Transações, não produtos.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="produtos">Produtos vendidos</Label>
                <Input
                  id="produtos"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="112"
                  value={form.produtos_vendidos}
                  onChange={(e) =>
                    atualizarCampo('produtos_vendidos', e.target.value.replace(/\D/g, ''))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Itens que saíram: 2 cestas numa venda contam 2.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="atendimentos">Pessoas atendidas</Label>
                <Input
                  id="atendimentos"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="180"
                  value={form.atendimentos}
                  onChange={(e) => atualizarCampo('atendimentos', e.target.value.replace(/\D/g, ''))}
                />
                <p className="text-xs text-muted-foreground">Inclusive quem não comprou.</p>
              </div>
            </div>

            {/* Os dois derivados. Ficam separados e explicados porque o caminho
                normal é NÃO preencher: eles saem da divisão dos campos acima.
                Existem pra quem anotou "ticket médio 620" sem saber o número
                de vendas — por divisão ela nunca chegaria lá. */}
            <div className="space-y-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground">
                Estes dois são calculados sozinhos pelos campos acima. Preencha apenas se você tiver
                o número anotado e ele não bater com a conta.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ticket">Ticket médio (R$)</Label>
                  <Input
                    id="ticket"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={
                      atual && atual.vendas > 0 && atual.faturamento > 0
                        ? brlCurto(atual.faturamento / atual.vendas)
                        : 'calculado'
                    }
                    value={form.ticket_medio}
                    onChange={(e) =>
                      atualizarCampo('ticket_medio', aplicarMascaraMoeda(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conversao">Taxa de conversão (%)</Label>
                  <Input
                    id="conversao"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="calculado"
                    value={form.conversao}
                    onChange={(e) =>
                      atualizarCampo('conversao', e.target.value.replace(/[^\d,.]/g, ''))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacao">Observação (opcional)</Label>
              <Input
                id="observacao"
                autoComplete="off"
                placeholder="Ex.: mês da feira de Natal"
                value={form.observacao}
                onChange={(e) => atualizarCampo('observacao', e.target.value)}
              />
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              {atual?.fonte === 'manual' ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={descartarFechamento}
                  disabled={descartando || salvando}
                  className="text-destructive hover:text-destructive"
                >
                  {descartando ? 'Apagando...' : 'Apagar preenchimento'}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setAberto(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
