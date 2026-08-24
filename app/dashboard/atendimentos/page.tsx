'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Atendimento {
  id: string;
  data: string;
  pessoas_atendidas: number;
}

const hoje = () => new Date().toISOString().slice(0, 10);

function fmtData(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

export default function AtendimentosPage() {
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [vendasPorDia, setVendasPorDia] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(hoje());
  const [pessoas, setPessoas] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/atendimentos');
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao carregar atendimentos');
      setAtendimentos(result.data || []);
      setVendasPorDia(result.vendasPorDia || {});
    } catch (error) {
      console.error('Erro ao carregar atendimentos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    const n = Number(pessoas);
    if (!Number.isFinite(n) || n < 0) {
      setErro('Informe quantas pessoas você atendeu.');
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch('/api/atendimentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, pessoas_atendidas: n }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao registrar atendimento');
      setPessoas('');
      setData(hoje());
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao registrar atendimento');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Quantas pessoas você atendeu hoje?</h1>
        <p className="mt-2 text-muted-foreground">
          Conte todo mundo com quem você falou — mesmo quem não comprou. Isso é a base da sua taxa
          de conversão.
        </p>
      </div>

      <form onSubmit={salvar} className="space-y-6 rounded-lg border bg-card p-6 shadow-sm sm:p-10">
        {erro && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {erro}
          </div>
        )}
        <div className="flex items-center gap-3">
          <Label htmlFor="at-data">Data</Label>
          <Input
            id="at-data"
            type="date"
            value={data}
            max={hoje()}
            onChange={(e) => setData(e.target.value)}
            className="h-9 w-auto"
          />
        </div>

        <div className="flex items-end justify-center gap-4">
          <Input
            id="at-pessoas"
            type="number"
            min={0}
            inputMode="numeric"
            value={pessoas}
            placeholder="0"
            onChange={(e) => setPessoas(e.target.value)}
            className="h-24 w-40 text-center text-5xl font-bold"
          />
          <span className="pb-6 text-lg font-medium text-muted-foreground">pessoas</span>
        </div>

        <Button type="submit" size="lg" className="h-14 w-full text-base font-bold uppercase" disabled={salvando}>
          {salvando ? 'Salvando...' : 'Registrar atendimento'}
        </Button>
      </form>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-bold">Histórico</h2>
        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Carregando...</p>
        ) : atendimentos.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum atendimento registrado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Pessoas atendidas</th>
                  <th className="px-4 py-3">Vendas do dia</th>
                  <th className="px-4 py-3">Conversão</th>
                </tr>
              </thead>
              <tbody>
                {atendimentos.map((a) => {
                  const vendasDia = vendasPorDia[a.data] ?? 0;
                  const conv = a.pessoas_atendidas > 0 ? (vendasDia / a.pessoas_atendidas) * 100 : 0;
                  return (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{fmtData(a.data)}</td>
                      <td className="px-4 py-3">{a.pessoas_atendidas}</td>
                      <td className="px-4 py-3">{vendasDia}</td>
                      <td className="px-4 py-3 font-bold">{conv.toFixed(1).replace('.', ',')}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
