'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PageShell from '@/components/shared/PageShell';
import { gravarMemoria, lerMemoria } from '@/lib/cache-memoria';
import PageHeader from '@/components/shared/PageHeader';
import { hojeBrasil } from '@/lib/datas';
import { aplicarMascaraTelefone, formatarTelefone } from '@/lib/telefone';
import { Trash2 } from 'lucide-react';

interface Atendimento {
  id: string;
  data: string;
  pessoas_atendidas: number;
}

/** Atendimento nominal (migration 018). Convive com a contagem acima. */
interface PessoaAtendida {
  id: string;
  data: string;
  nome: string;
  telefone: string | null;
  ddi: string | null;
  origem: string | null;
  observacao: string | null;
}

// Mesma lógica de customers.how_knew: sugestões, não lista fechada. Quem vende
// em bazar precisa poder escrever o dela em vez de marcar "Outros".
const ORIGENS_SUGERIDAS = [
  'Instagram',
  'WhatsApp',
  'Indicação',
  'Feira',
  'Loja física',
  'Google',
];

const hoje = () => hojeBrasil();

function fmtData(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

export default function AtendimentosPage() {
  const emCache = lerMemoria<{ atendimentos: Atendimento[]; vendasPorDia: Record<string, number> }>(
    'atendimentos',
  );
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>(emCache?.atendimentos ?? []);
  const [vendasPorDia, setVendasPorDia] = useState<Record<string, number>>(
    emCache?.vendasPorDia ?? {},
  );
  const [loading, setLoading] = useState(emCache === undefined);
  const [data, setData] = useState(hoje());
  const [pessoas, setPessoas] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Registro nominal. Fica recolhido porque a contagem rápida é o caminho de
  // sempre — quem está no meio de uma feira digita um número e segue.
  const [pessoasAtendidas, setPessoasAtendidas] = useState<PessoaAtendida[]>([]);
  const [formAberto, setFormAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [origem, setOrigem] = useState('');
  const [salvandoPessoa, setSalvandoPessoa] = useState(false);

  const carregar = async () => {
    try {
      const [res, resPessoas] = await Promise.all([
        fetch('/api/atendimentos'),
        fetch('/api/atendimentos/pessoas'),
      ]);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao carregar atendimentos');

      // O nominal não pode derrubar a tela: se ele falhar, a contagem — que é
      // o que sustenta a conversão — continua aparecendo.
      if (resPessoas.ok) {
        const dados = await resPessoas.json();
        setPessoasAtendidas(dados.data || []);
      }

      setAtendimentos(result.data || []);
      setVendasPorDia(result.vendasPorDia || {});
      gravarMemoria('atendimentos', {
        atendimentos: result.data || [],
        vendasPorDia: result.vendasPorDia || {},
      });
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

  const salvarPessoa = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!nome.trim()) {
      setErro('Informe o nome de quem você atendeu.');
      return;
    }

    setSalvandoPessoa(true);
    try {
      const res = await fetch('/api/atendimentos/pessoas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data,
          nome: nome.trim(),
          telefone: telefone.trim() || undefined,
          origem: origem.trim() || undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao registrar');

      setNome('');
      setTelefone('');
      setOrigem('');
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao registrar');
    } finally {
      setSalvandoPessoa(false);
    }
  };

  const removerPessoa = async (id: string) => {
    await fetch(`/api/atendimentos/pessoas?id=${id}`, { method: 'DELETE' });
    await carregar();
  };

  // Quantos nominais em cada dia — para a tabela mostrar a contagem que vale.
  const nominaisPorDia = pessoasAtendidas.reduce<Record<string, number>>((acc, p) => {
    acc[p.data] = (acc[p.data] ?? 0) + 1;
    return acc;
  }, {});

  // Um dia em que ela SÓ anotou nomes, sem digitar a contagem, não existe em
  // `atendimentos` — e sumiria do histórico inteiro. Estes dias entram como
  // linhas próprias, para que anotar nome nunca esconda o trabalho do dia.
  const diasSoNominais = Object.keys(nominaisPorDia)
    .filter((dia) => !atendimentos.some((a) => a.data === dia))
    .map((dia) => ({ id: `nominal-${dia}`, data: dia, pessoas_atendidas: 0 }));

  const linhasDoHistorico = [...atendimentos, ...diasSoNominais].sort((a, b) =>
    a.data > b.data ? -1 : 1,
  );

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Quantas pessoas você atendeu hoje?"
        description="Conte todo mundo com quem você falou — mesmo quem não comprou. Isso é a base da sua taxa de conversão."
      />

      <form onSubmit={salvar} className="vidro space-y-6 rounded-2xl p-6 sm:p-10">
        {erro && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
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

      {/* REGISTRO NOMINAL. Recolhido de propósito: a contagem rápida acima é o
          caminho de sempre, e quem está no meio de uma feira digita um número
          e segue. Quem quer acompanhar pessoa a pessoa abre isto. */}
      <section className="mt-6">
        <button
          type="button"
          onClick={() => setFormAberto((a) => !a)}
          className="text-sm font-semibold text-primary hover:underline"
        >
          {formAberto ? '− Anotar quem foi' : '+ Anotar quem foi (nome, contato, origem)'}
        </button>

        {formAberto && (
          <form onSubmit={salvarPessoa} className="vidro mt-3 space-y-3 rounded-2xl p-4 sm:p-6">
            <p className="text-xs text-muted-foreground">
              Anotar nome não muda a sua contagem do dia: vale sempre o maior entre o número
              que você digitou e quantas pessoas você detalhou.
            </p>
            <Input
              aria-label="Nome de quem você atendeu"
              placeholder="Nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                aria-label="Telefone"
                inputMode="tel"
                placeholder="Telefone (opcional)"
                value={telefone}
                onChange={(e) => setTelefone(aplicarMascaraTelefone(e.target.value))}
              />
              <Input
                aria-label="Origem"
                list="origens-de-atendimento"
                autoComplete="off"
                placeholder="Veio de onde?"
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
              />
              <datalist id="origens-de-atendimento">
                {ORIGENS_SUGERIDAS.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>
            <Button type="submit" variant="outline" className="w-full" disabled={salvandoPessoa}>
              {salvandoPessoa ? 'Salvando...' : 'Anotar atendimento'}
            </Button>
          </form>
        )}

        {pessoasAtendidas.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Pessoas anotadas ({pessoasAtendidas.length})
            </h3>
            {pessoasAtendidas.slice(0, 20).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium">{p.nome}</span>
                  <span className="ml-2 text-muted-foreground">
                    {[fmtData(p.data), p.origem, formatarTelefone(p.telefone)]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label={`Remover ${p.nome}`}
                  onClick={() => removerPessoa(p.id)}
                  className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-bold">Histórico</h2>
        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Carregando...</p>
        ) : linhasDoHistorico.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum atendimento registrado ainda.
          </p>
        ) : (
          <div className="vidro overflow-x-auto rounded-2xl">
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
                {linhasDoHistorico.map((a) => {
                  const vendasDia = vendasPorDia[a.data] ?? 0;
                  // Vale o MAIOR entre o digitado e o detalhado, nunca a soma:
                  // quem digitou 12 e anotou 3 atendeu 12, e somar inflaria a
                  // conversão. Regra em lib/atendimentos.ts, com teste.
                  const total = Math.max(a.pessoas_atendidas, nominaisPorDia[a.data] ?? 0);
                  const conv = total > 0 ? (vendasDia / total) * 100 : 0;
                  return (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{fmtData(a.data)}</td>
                      <td className="px-4 py-3">{total}</td>
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
    </PageShell>
  );
}
