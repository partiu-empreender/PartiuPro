'use client';

/**
 * Financeiro: as saídas do mês e o resultado (DRE).
 *
 * O sistema sabia quanto entrava e não sabia quanto saía — então "lucro" era
 * uma conta que a aluna fazia de cabeça, quando fazia. Faturamento alto com
 * lucro baixo é invisível até alguém somar as despesas.
 *
 * As duas linhas de custo ficam SEPARADAS de propósito (custo dos produtos e
 * despesas): se o lucro bruto está bom e o líquido não, o problema é despesa
 * fixa; se o próprio bruto está ruim, é preço ou custo do produto. São duas
 * conversas diferentes, e é a segunda linha que diz qual delas ter.
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageShell from '@/components/shared/PageShell';
import PageHeader from '@/components/shared/PageHeader';
import { Trash2 } from 'lucide-react';
import { hojeBrasil, MESES, nomeDoMes, partesHojeBrasil } from '@/lib/datas';
import { aplicarMascaraMoeda } from '@/lib/moeda';
import type { DRE } from '@/lib/dre';
import type { SaldoDoMes } from '@/lib/saldo';

interface Saida {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  categoria: string;
  recorrente: boolean;
  observacao: string | null;
}

// Sugestões, não lista fechada: quem tem uma despesa fora do previsto precisa
// poder escrever a dela em vez de marcar "Outros" e perder a informação.
const CATEGORIAS_SUGERIDAS = [
  'Insumos',
  'Embalagens',
  'Internet',
  'Aluguel',
  'Transporte',
  'Marketing',
  'Ferramentas',
  'Impostos',
  'Outros',
];

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDia = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export default function FinanceiroPage() {
  const hoje = partesHojeBrasil();
  const [ano, setAno] = useState(hoje.ano);
  const [mes, setMes] = useState(hoje.mes);

  const [saidas, setSaidas] = useState<Saida[]>([]);
  const [dre, setDre] = useState<DRE | null>(null);
  const [saldo, setSaldo] = useState<SaldoDoMes | null>(null);
  // Falso quando o servidor não conseguiu calcular o saldo (ex.: migration 022
  // ainda não aplicada). Aí o cartão some, em vez de convidar a informar um
  // saldo que não teria onde ser gravado.
  const [saldoDisponivel, setSaldoDisponivel] = useState(false);
  const [editandoSaldo, setEditandoSaldo] = useState(false);
  const [valorSaldo, setValorSaldo] = useState('');
  const [salvandoSaldo, setSalvandoSaldo] = useState(false);
  const [erroSaldo, setErroSaldo] = useState('');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const [data, setData] = useState(hojeBrasil());
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState('Insumos');
  const [recorrente, setRecorrente] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = async (anoAlvo: number, mesAlvo: number) => {
    try {
      const res = await fetch(`/api/financeiro?ano=${anoAlvo}&mes=${mesAlvo}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao carregar');
      setSaidas(result.saidas || []);
      setDre(result.dre || null);
      setSaldo(result.saldo ?? null);
      setSaldoDisponivel(Boolean(result.saldo_disponivel));
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setEditandoSaldo(false);
    setErroSaldo('');
    carregar(ano, mes);
  }, [ano, mes]);

  const salvarSaldo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroSaldo('');
    if (!valorSaldo.trim()) {
      setErroSaldo('Informe o valor.');
      return;
    }
    setSalvandoSaldo(true);
    try {
      const res = await fetch('/api/financeiro/saldo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // STRING, pelo mesmo motivo da saída: o servidor usa `parsearMoeda`.
        body: JSON.stringify({ ano, mes, valor: valorSaldo }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao salvar o saldo');
      setEditandoSaldo(false);
      await carregar(ano, mes);
    } catch (error) {
      setErroSaldo(error instanceof Error ? error.message : 'Erro ao salvar o saldo');
    } finally {
      setSalvandoSaldo(false);
    }
  };

  const removerSaldo = async () => {
    setErroSaldo('');
    const res = await fetch(`/api/financeiro/saldo?ano=${ano}&mes=${mes}`, { method: 'DELETE' });
    if (!res.ok) {
      const result = await res.json().catch(() => ({}));
      setErroSaldo(result.error || 'Erro ao remover o saldo');
      return;
    }
    await carregar(ano, mes);
  };

  const abrirEdicaoSaldo = () => {
    // Abre com o saldo inicial que está na tela, informado ou calculado: o
    // caso comum é ajustar uns reais depois de conferir o extrato, não
    // redigitar tudo.
    setValorSaldo(
      saldo
        ? `${saldo.saldoInicial < 0 ? '-' : ''}${aplicarMascaraMoeda(
            Math.abs(saldo.saldoInicial).toFixed(2).replace('.', ','),
          )}`
        : '',
    );
    setErroSaldo('');
    setEditandoSaldo(true);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!descricao.trim()) {
      setErro('Descreva a saída.');
      return;
    }
    if (!valor.trim()) {
      setErro('Informe o valor.');
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch('/api/financeiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // O valor vai como STRING: o servidor usa `parsearMoeda`, porque
        // Number('1.200') devolveria 1.2 e mil e duzentos viraria um e vinte.
        body: JSON.stringify({ data, descricao, valor, categoria, recorrente }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao registrar');

      setDescricao('');
      setValor('');
      setRecorrente(false);
      await carregar(ano, mes);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao registrar');
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (id: string) => {
    await fetch(`/api/financeiro?id=${id}`, { method: 'DELETE' });
    await carregar(ano, mes);
  };

  const anos = [hoje.ano, hoje.ano - 1];

  return (
    <PageShell>
      <PageHeader
        title="Financeiro"
        description="Registre o que sai e veja o que sobra. Quanto entrou, quanto custou e quanto ficou com você."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <select
          aria-label="Mês"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={mes}
          onChange={(e) => setMes(Number(e.target.value))}
        >
          {MESES.map((nome, indice) => (
            <option key={nome} value={indice + 1}>
              {nome}
            </option>
          ))}
        </select>
        <select
          aria-label="Ano"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={ano}
          onChange={(e) => setAno(Number(e.target.value))}
        >
          {anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {erro && (
        <div className="mb-4 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      {/* Saldo em conta. Vem antes do DRE porque é a pergunta mais
          imediata — "quanto eu tenho?" — e é o número que ela confere com o
          extrato do banco. */}
      {!loading && saldoDisponivel && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Saldo em conta em {nomeDoMes(mes).toLowerCase()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {erroSaldo && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {erroSaldo}
              </div>
            )}

            {saldo && !editandoSaldo && (
              <div className="space-y-1 text-sm">
                <LinhaDoDRE
                  rotulo="Saldo inicial"
                  valor={saldo.saldoInicial}
                  complemento={
                    saldo.origem === 'informado'
                      ? 'informado por você'
                      : `calculado desde ${nomeDoMes(saldo.ancora.mes).toLowerCase()}/${saldo.ancora.ano}`
                  }
                />
                <LinhaDoDRE rotulo="Entradas (vendas pagas)" valor={saldo.entradas} />
                <LinhaDoDRE rotulo="Saídas (despesas e frete)" valor={-saldo.saidas} />
                <LinhaDoDRE rotulo="Saldo final do mês" valor={saldo.saldoFinal} destaque />
                <p className="pt-2 text-xs text-muted-foreground">
                  Vendas &quot;a receber&quot; só entram quando marcadas como pagas. O saldo final
                  vira o saldo inicial do mês seguinte — se não bater com o extrato, corrija o
                  saldo inicial do mês e a conta segue certa dali em diante.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={abrirEdicaoSaldo}>
                    Corrigir saldo inicial
                  </Button>
                  {saldo.origem === 'informado' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={removerSaldo}
                    >
                      Remover saldo informado
                    </Button>
                  )}
                </div>
              </div>
            )}

            {!saldo && !editandoSaldo && (
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Quanto você tinha em conta no início de {nomeDoMes(mes).toLowerCase()}? Com esse
                  ponto de partida, o app soma o que você vendeu, tira o que saiu e mostra o saldo
                  real de cada mês. Pode ser um mês anterior ao que você começou a usar o app.
                </p>
                <Button type="button" size="sm" onClick={abrirEdicaoSaldo}>
                  Informar saldo inicial
                </Button>
              </div>
            )}

            {editandoSaldo && (
              <form onSubmit={salvarSaldo} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="fin-saldo">
                    Saldo em conta em 1º de {nomeDoMes(mes).toLowerCase()} de {ano}
                  </Label>
                  <Input
                    id="fin-saldo"
                    inputMode="decimal"
                    placeholder="0,00"
                    autoFocus
                    value={valorSaldo}
                    onChange={(e) => {
                      // Mesma máscara do valor da saída, preservando o sinal
                      // de menos: conta no vermelho é saldo real.
                      const negativo = e.target.value.trim().startsWith('-');
                      const mascarado = aplicarMascaraMoeda(e.target.value);
                      setValorSaldo(negativo ? `-${mascarado}` : mascarado);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Se a conta estava negativa, comece com o sinal de menos (-).
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={salvandoSaldo}>
                    {salvandoSaldo ? 'Salvando...' : 'Salvar saldo'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditandoSaldo(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* O DRE. A ordem das linhas é a da conta, para poder ser lida de cima
          pra baixo sem explicação. */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Resultado de {nomeDoMes(mes).toLowerCase()}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-6 text-center text-muted-foreground">Carregando...</p>
          ) : !dre ? (
            <p className="py-6 text-center text-muted-foreground">Nada para mostrar.</p>
          ) : (
            <div className="space-y-1 text-sm">
              <LinhaDoDRE rotulo="Faturamento" valor={dre.faturamento} />
              <LinhaDoDRE rotulo="Custo dos produtos" valor={-dre.custoDosProdutos} />
              <LinhaDoDRE
                rotulo="Lucro bruto"
                valor={dre.lucroBruto}
                complemento={`${dre.margemBruta.toFixed(0)}% de margem`}
                destaque
              />

              <div className="h-2" />

              <LinhaDoDRE rotulo="Despesas" valor={-dre.despesas} />
              {dre.frete > 0 && <LinhaDoDRE rotulo="Frete pago" valor={-dre.frete} />}
              <LinhaDoDRE
                rotulo="Lucro líquido"
                valor={dre.lucroLiquido}
                complemento={`${dre.margemLiquida.toFixed(0)}% de margem`}
                destaque
              />

              {dre.porCategoria.length > 0 && (
                <div className="pt-4">
                  <h3 className="mb-2 text-sm font-semibold">Para onde foi</h3>
                  {dre.porCategoria.map((linha) => (
                    <div
                      key={linha.categoria}
                      className="flex items-center justify-between border-b py-1.5 last:border-0"
                    >
                      <span>{linha.categoria}</span>
                      <span className="text-muted-foreground">
                        {linha.percentual.toFixed(0)}%
                      </span>
                      <span className="font-semibold">{brl(linha.valor)}</span>
                    </div>
                  ))}
                </div>
              )}

              <p className="pt-3 text-xs text-muted-foreground">
                O custo dos produtos usa o custo cadastrado hoje no catálogo. Itens sem custo
                preenchido entram como zero — o lucro aparece maior do que é até você preencher.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Registrar saída</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={salvar} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fin-descricao">Descrição</Label>
                <Input
                  id="fin-descricao"
                  placeholder="Cestas, fitas, embalagens..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fin-valor">Valor</Label>
                <Input
                  id="fin-valor"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={valor}
                  onChange={(e) => setValor(aplicarMascaraMoeda(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fin-categoria">Categoria</Label>
                <Input
                  id="fin-categoria"
                  list="categorias-de-saida"
                  autoComplete="off"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                />
                <datalist id="categorias-de-saida">
                  {CATEGORIAS_SUGERIDAS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fin-data">Data</Label>
                <Input
                  id="fin-data"
                  type="date"
                  max={hojeBrasil()}
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={recorrente}
                onChange={(e) => setRecorrente(e.target.checked)}
              />
              Despesa fixa (se repete todo mês)
            </label>

            <Button type="submit" className="w-full" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Registrar saída'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saídas de {nomeDoMes(mes).toLowerCase()} ({saidas.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="py-4 text-center text-muted-foreground">Carregando...</p>
          ) : saidas.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma saída registrada neste mês.
            </p>
          ) : (
            saidas.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 border-b pb-2 text-sm last:border-0"
              >
                <div className="min-w-0">
                  <span className="font-medium">{s.descricao}</span>
                  <span className="ml-2 text-muted-foreground">
                    {fmtDia(s.data)} · {s.categoria}
                    {s.recorrente && ' · fixa'}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-semibold">{brl(s.valor)}</span>
                  <button
                    type="button"
                    aria-label={`Remover ${s.descricao}`}
                    onClick={() => remover(s.id)}
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}

/**
 * Uma linha do DRE. Valor negativo aparece em vermelho e com sinal — quem lê
 * precisa distinguir o que soma do que subtrai sem reconstruir a conta.
 */
function LinhaDoDRE({
  rotulo,
  valor,
  complemento,
  destaque,
}: {
  rotulo: string;
  valor: number;
  complemento?: string;
  destaque?: boolean;
}) {
  const negativo = valor < 0;
  return (
    <div
      className={`flex items-baseline justify-between gap-2 py-1.5 ${
        destaque ? 'border-t font-bold' : ''
      }`}
    >
      <span>{rotulo}</span>
      {complemento && (
        <span className="text-xs text-muted-foreground">{complemento}</span>
      )}
      <span className={negativo ? 'text-destructive' : undefined}>
        {negativo ? `− ${brl(Math.abs(valor))}` : brl(valor)}
      </span>
    </div>
  );
}
