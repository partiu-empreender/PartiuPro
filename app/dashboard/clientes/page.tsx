'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
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
import { Download, HelpCircle, LayoutGrid, List, Plus, Search, Tag, Upload, Users } from 'lucide-react';
import PageShell from '@/components/shared/PageShell';
import PageHeader from '@/components/shared/PageHeader';
import EtiquetaBadge, {
  EtiquetaToggle,
  CORES_ETIQUETA,
  type CorEtiqueta,
  type Etiqueta,
} from '@/components/shared/EtiquetaBadge';
import { ETIQUETAS_SUGERIDAS, NOME_DA_COR } from '@/lib/etiquetas';
import { aplicarMascaraTelefone, formatarTelefone } from '@/lib/telefone';
import { CABECALHOS_CLIENTES, LINHAS_EXEMPLO_CLIENTES, gerarCSV, lerCSV } from '@/lib/csv';
import { cn } from '@/lib/utils';
import { gravarMemoria, lerMemoria } from '@/lib/cache-memoria';
import {
  ORDENS,
  SITUACOES,
  ordenarClientes,
  passaNaSituacao,
  type OrdemCliente,
  type SituacaoCliente,
} from '@/lib/filtros-clientes';

interface Cliente {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  total_orders: number | null;
  total_spent: number | null;
  last_order_at: string | null;
  etiquetas: Etiqueta[];
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// "há 3 meses" diz mais do que uma data pra decidir quem chamar hoje — que é
// pra isso que a Tania vai olhar esta coluna.
function desdeAUltimaCompra(iso: string | null | undefined): string {
  if (!iso) return 'Nunca comprou';

  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return 'Hoje';
  if (dias === 1) return 'Ontem';
  if (dias < 30) return `Há ${dias} dias`;

  const meses = Math.floor(dias / 30);
  return meses === 1 ? 'Há 1 mês' : `Há ${meses} meses`;
}

interface ResultadoImportacao {
  criadas: number;
  atualizadas: number;
  ignoradas: { linha: number; nome: string; motivo: string }[];
  colunasIgnoradas: string[];
  etiquetasCriadas: string[];
}

const formVazio = { name: '', phone: '', email: '', notes: '', date_of_birth: '' };

export default function ClientesPage() {
  const emCache = lerMemoria<{ clientes: Cliente[]; etiquetas: Etiqueta[] }>('clientes');
  const [clientes, setClientes] = useState<Cliente[]>(emCache?.clientes ?? []);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>(emCache?.etiquetas ?? []);
  const [loading, setLoading] = useState(emCache === undefined);
  const [busca, setBusca] = useState('');
  const [filtroEtiqueta, setFiltroEtiqueta] = useState<string | null>(null);

  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState(formVazio);
  const [etiquetasDoForm, setEtiquetasDoForm] = useState<string[]>([]);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [importando, setImportando] = useState(false);
  const [previa, setPrevia] = useState<{ csv: string; nomes: string[]; ignoradas: string[] } | null>(null);
  const [resultadoImport, setResultadoImport] = useState<ResultadoImportacao | null>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);

  const [gerenciandoEtiquetas, setGerenciandoEtiquetas] = useState(false);
  const [novaEtiqueta, setNovaEtiqueta] = useState('');
  const [novaCor, setNovaCor] = useState<CorEtiqueta>('slate');
  const [criandoEtiquetas, setCriandoEtiquetas] = useState(false);
  const [mostrandoAjudaCSV, setMostrandoAjudaCSV] = useState(false);

  // Situação e ordem são aplicadas aqui no navegador; busca e etiqueta
  // continuam no banco. A visão escolhida sobrevive à navegação porque fica no
  // mesmo cache de sessão das telas — trocar de aba e voltar não a reseta.
  const [situacao, setSituacao] = useState<SituacaoCliente>('todas');
  const [ordem, setOrdem] = useState<OrdemCliente>('nome');
  const [visao, setVisao] = useState<'cartoes' | 'lista'>(
    () => lerMemoria<'cartoes' | 'lista'>('visao-clientes') ?? 'cartoes',
  );

  const trocarVisao = (nova: 'cartoes' | 'lista') => {
    setVisao(nova);
    gravarMemoria('visao-clientes', nova);
  };

  const jaCarregou = useRef(false);

  const carregar = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (busca.trim()) params.set('busca', busca.trim());
      if (filtroEtiqueta) params.set('etiqueta', filtroEtiqueta);

      const [resClientes, resEtiquetas] = await Promise.all([
        fetch(`/api/clientes?${params.toString()}`),
        fetch('/api/etiquetas'),
      ]);
      const [dadosClientes, dadosEtiquetas] = await Promise.all([
        resClientes.json(),
        resEtiquetas.json(),
      ]);

      if (resClientes.ok) setClientes(dadosClientes.data || []);
      if (resEtiquetas.ok) setEtiquetas(dadosEtiquetas.data || []);

      // Só guarda a lista sem filtro: guardar o resultado de uma busca faria
      // a tela reabrir mostrando o filtro anterior como se fosse tudo.
      if (resClientes.ok && resEtiquetas.ok && !busca.trim() && !filtroEtiqueta) {
        gravarMemoria('clientes', {
          clientes: dadosClientes.data || [],
          etiquetas: dadosEtiquetas.data || [],
        });
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    } finally {
      // Só o primeiro carregamento mostra "Carregando...". Buscas seguintes
      // atualizam a lista no lugar, sem a tela piscar a cada tecla digitada.
      if (!jaCarregou.current) {
        jaCarregou.current = true;
        setLoading(false);
      }
    }
  }, [busca, filtroEtiqueta]);

  // Espera a digitação parar antes de consultar o servidor.
  useEffect(() => {
    const timer = setTimeout(carregar, busca ? 300 : 0);
    return () => clearTimeout(timer);
  }, [carregar, busca]);

  const abrirNovo = () => {
    setEditando(null);
    setForm(formVazio);
    setEtiquetasDoForm([]);
    setErro('');
    setAberto(true);
  };

  const abrirEdicao = (c: Cliente) => {
    setEditando(c);
    setForm({
      name: c.name,
      phone: c.phone ? formatarTelefone(c.phone) : '',
      email: c.email || '',
      notes: c.notes || '',
      date_of_birth: '',
    });
    setEtiquetasDoForm(c.etiquetas.map((e) => e.id));
    setErro('');
    setAberto(true);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!form.name.trim()) {
      setErro('Informe o nome da cliente.');
      return;
    }

    // O telefone é a chave que impede a mesma cliente de entrar duas vezes na
    // base, e é por ele que a venda reencontra quem já está cadastrada.
    if (!form.phone.trim()) {
      setErro('Informe o telefone da cliente.');
      return;
    }

    setSalvando(true);
    try {
      const url = editando ? `/api/clientes/${editando.id}` : '/api/clientes';
      const res = await fetch(url, {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tag_ids: etiquetasDoForm }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao salvar cliente');
      setAberto(false);
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao salvar cliente');
    } finally {
      setSalvando(false);
    }
  };

  // Monta o modelo aqui no navegador em vez de pedir ao servidor: e o mesmo
  // conteudo sempre, entao uma ida ate la seria so espera. E funciona igual
  // com a internet oscilando, que e o cenario da aula.
  const baixarModelo = () => {
    const csv = gerarCSV(CABECALHOS_CLIENTES, LINHAS_EXEMPLO_CLIENTES);
    const endereco = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));

    const link = document.createElement('a');
    link.href = endereco;
    link.download = 'modelo-clientes-partiu-pro.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Alguns navegadores ainda estao lendo o Blob quando o clique retorna;
    // liberar na hora cancelaria o download.
    setTimeout(() => URL.revokeObjectURL(endereco), 1000);
  };

  const criarEtiqueta = async (nome: string, cor: CorEtiqueta) => {
    if (!nome.trim()) return;
    await fetch('/api/etiquetas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: nome.trim(), cor }),
    });
    setNovaEtiqueta('');
    await carregar();
  };

  // Adicionar as dez sugestões uma a uma seria dez cliques e dez recargas.
  // Aqui vai tudo em série e a lista recarrega uma vez só, no fim.
  const criarTodasAsSugestoes = async () => {
    if (criandoEtiquetas) return;
    setCriandoEtiquetas(true);
    try {
      for (const sugestao of sugestoesRestantes) {
        await fetch('/api/etiquetas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sugestao),
        });
      }
      await carregar();
    } finally {
      setCriandoEtiquetas(false);
    }
  };

  const removerEtiqueta = async (id: string) => {
    await fetch(`/api/etiquetas/${id}`, { method: 'DELETE' });
    if (filtroEtiqueta === id) setFiltroEtiqueta(null);
    await carregar();
  };

  const alternarEtiquetaNoForm = (id: string) =>
    setEtiquetasDoForm((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );

  // Lê o arquivo no navegador e mostra o que será importado ANTES de gravar.
  // A Tania vai fazer isso ao vivo na frente das alunas: importar às cegas e
  // descobrir o erro depois seria o pior momento possível.
  const escolherArquivo = async (arquivo: File) => {
    const texto = await arquivo.text();
    const { linhas, colunasIgnoradas, temColunaNome } = lerCSV(texto);

    if (!temColunaNome) {
      setResultadoImport(null);
      setPrevia({ csv: '', nomes: [], ignoradas: ['A planilha precisa ter uma coluna de nome.'] });
      return;
    }

    setResultadoImport(null);
    setPrevia({
      csv: texto,
      nomes: linhas.map((l) => l.nome || '').filter(Boolean),
      ignoradas: colunasIgnoradas,
    });
  };

  const confirmarImportacao = async () => {
    if (!previa?.csv) return;
    setImportando(true);
    try {
      const res = await fetch('/api/clientes/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: previa.csv }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao importar');
      setResultadoImport(result.data);
      setPrevia(null);
      await carregar();
    } catch (error) {
      setPrevia((p) =>
        p ? { ...p, ignoradas: [error instanceof Error ? error.message : 'Erro ao importar'] } : p,
      );
    } finally {
      setImportando(false);
    }
  };

  const clientesVisiveis = ordenarClientes(
    clientes.filter((cliente) => passaNaSituacao(cliente, situacao)),
    ordem,
  );

  const sugestoesRestantes = ETIQUETAS_SUGERIDAS.filter(
    (s) => !etiquetas.some((e) => e.nome.toLowerCase() === s.nome.toLowerCase()),
  );

  return (
    <PageShell>
      <PageHeader
        title="Minhas clientes"
        description="Sua base de contatos — quem comprou, o quê, e quando falar de novo."
        action={
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputArquivo}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                if (arquivo) escolherArquivo(arquivo);
                // Zera pra permitir escolher o MESMO arquivo de novo depois de
                // corrigi-lo — senao o onChange nao dispara na segunda vez.
                e.target.value = '';
              }}
            />
            <Button variant="outline" onClick={() => inputArquivo.current?.click()}>
              <Download className="mr-2 h-4 w-4" /> Importar
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Como preparar a planilha"
              title="Como preparar a planilha"
              onClick={() => setMostrandoAjudaCSV(true)}
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
            <a href="/api/clientes/exportar">
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" /> Exportar
              </Button>
            </a>
            <Button onClick={abrirNovo} className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Nova cliente
            </Button>
          </div>
        }
      />

      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome ou telefone..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltroEtiqueta(null)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              filtroEtiqueta === null
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-white/60 text-muted-foreground backdrop-blur-md hover:bg-accent',
            )}
          >
            Todas
          </button>
          {etiquetas.map((etiqueta) => (
            <EtiquetaToggle
              key={etiqueta.id}
              etiqueta={etiqueta}
              ativa={filtroEtiqueta === etiqueta.id}
              onClick={() => setFiltroEtiqueta(filtroEtiqueta === etiqueta.id ? null : etiqueta.id)}
            />
          ))}
          <Button variant="ghost" size="sm" onClick={() => setGerenciandoEtiquetas(true)}>
            <Tag className="mr-2 h-3 w-3" /> Etiquetas
          </Button>
        </div>

        {/* Filtros de situação. Cada um veio de algo que a Tania descreveu na
            reunião contando como funcionava o sistema da Reserva: "você tem 10
            contatos de aniversário, 20 contatos de clientes que não compram há
            seis meses". A ideia é a lista virar a lista de quem ligar hoje. */}
        <div className="flex flex-wrap items-center gap-2">
          {SITUACOES.map((s) => (
            <button
              key={s.valor}
              type="button"
              title={s.ajuda}
              aria-pressed={situacao === s.valor}
              onClick={() => setSituacao(s.valor)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                situacao === s.valor
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-white/60 text-muted-foreground backdrop-blur-md hover:bg-accent',
              )}
            >
              {s.rotulo}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Ordenar por
            <select
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as OrdemCliente)}
              className="h-9 rounded-xl border border-input bg-white/70 px-3 text-xs text-foreground backdrop-blur-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              {ORDENS.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-1 rounded-full border border-input bg-white/60 p-1 backdrop-blur-md">
            {(
              [
                { valor: 'cartoes' as const, Icone: LayoutGrid, rotulo: 'Cartões' },
                { valor: 'lista' as const, Icone: List, rotulo: 'Lista' },
              ]
            ).map(({ valor, Icone, rotulo }) => (
              <button
                key={valor}
                type="button"
                aria-pressed={visao === valor}
                title={rotulo}
                onClick={() => trocarVisao(valor)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  visao === valor
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent',
                )}
              >
                <Icone className="h-3.5 w-3.5" />
                {rotulo}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-muted-foreground">Carregando...</p>
      ) : clientes.length === 0 ? (
        <Card className="mx-auto max-w-md">
          <CardContent className="space-y-5 px-8 py-10 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {busca || filtroEtiqueta
                ? 'Nenhuma cliente encontrada com esse filtro.'
                : 'Sua base de clientes é o seu maior ativo. Cadastre a primeira — ou registre uma venda com o nome e o telefone, que ela entra aqui sozinha.'}
            </p>
            {!busca && !filtroEtiqueta && (
              <div className="space-y-2">
                <Button onClick={abrirNovo} className="w-full">
                  <Plus className="mr-2 h-4 w-4" /> Cadastrar minha primeira cliente
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setMostrandoAjudaCSV(true)}>
                  <Download className="mr-2 h-4 w-4" /> Já tenho uma lista pra importar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : clientesVisiveis.length === 0 ? (
        <Card className="mx-auto max-w-md">
          <CardContent className="space-y-4 px-8 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma cliente nesta situação agora. Isso é uma boa notícia, dependendo do filtro.
            </p>
            <Button variant="outline" onClick={() => setSituacao('todas')}>
              Ver todas as clientes
            </Button>
          </CardContent>
        </Card>
      ) : visao === 'lista' ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {clientesVisiveis.length} cliente{clientesVisiveis.length > 1 ? 's' : ''}
          </p>
          {/* A tabela rola na horizontal no celular em vez de espremer as
              colunas — nome e telefone, que é o que ela usa pra ligar, ficam
              nas duas primeiras e sempre à vista. */}
          <div className="vidro overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Telefone</th>
                  <th className="px-4 py-3 font-semibold">Etiquetas</th>
                  <th className="px-4 py-3 font-semibold">Última compra</th>
                  <th className="px-4 py-3 text-right font-semibold">Compras</th>
                  <th className="px-4 py-3 text-right font-semibold">Total gasto</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {clientesVisiveis.map((cliente) => (
                  <tr key={cliente.id} className="transition-colors hover:bg-accent/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/clientes/${cliente.id}`}
                        className="font-medium hover:underline"
                      >
                        {cliente.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {cliente.phone ? formatarTelefone(cliente.phone) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {cliente.etiquetas.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {cliente.etiquetas.map((etiqueta) => (
                            <EtiquetaBadge key={etiqueta.id} etiqueta={etiqueta} />
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {desdeAUltimaCompra(cliente.last_order_at)}
                    </td>
                    <td className="px-4 py-3 text-right">{cliente.total_orders || 0}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {brl(cliente.total_spent || 0)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => abrirEdicao(cliente)}>
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {clientesVisiveis.length} cliente{clientesVisiveis.length > 1 ? 's' : ''}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clientesVisiveis.map((cliente) => (
              <Card key={cliente.id} className="transition-colors hover:bg-white/90">
                <CardContent className="space-y-3 p-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/clientes/${cliente.id}`}
                        className="block truncate font-semibold hover:underline"
                      >
                        {cliente.name}
                      </Link>
                      {cliente.phone && (
                        <p className="text-sm text-muted-foreground">{formatarTelefone(cliente.phone)}</p>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => abrirEdicao(cliente)}>
                      Editar
                    </Button>
                  </div>

                  {cliente.etiquetas.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {cliente.etiquetas.map((etiqueta) => (
                        <EtiquetaBadge key={etiqueta.id} etiqueta={etiqueta} />
                      ))}
                    </div>
                  )}

                  {cliente.notes && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{cliente.notes}</p>
                  )}

                  <div className="flex justify-between border-t pt-2 text-sm">
                    <span className="text-muted-foreground">
                      {cliente.total_orders || 0} compra{(cliente.total_orders || 0) === 1 ? '' : 's'}
                    </span>
                    <span className="font-semibold">{brl(cliente.total_spent || 0)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Cadastro / edição */}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar cliente' : 'Nova cliente'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            {erro && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {erro}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="cliente-nome">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cliente-nome"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cliente-telefone">
                Telefone <span className="text-destructive">*</span>
              </Label>
                <Input
                  id="cliente-telefone"
                  inputMode="tel"
                  placeholder="(21) 99999-8888"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: aplicarMascaraTelefone(e.target.value) }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cliente-nascimento">Aniversário</Label>
                <Input
                  id="cliente-nascimento"
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente-contexto">Contexto</Label>
              <textarea
                id="cliente-contexto"
                rows={3}
                className="flex w-full rounded-xl border border-input bg-white/70 px-4 py-2 text-sm backdrop-blur-md transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                placeholder="Prefere receber à tarde. Comprou cesta de café da manhã pro aniversário da mãe."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Preferências de entrega, o que ela já comprou, datas que importam — o que ajuda a
                vender melhor na próxima.
              </p>
            </div>
            {etiquetas.length > 0 && (
              <div className="space-y-2">
                <Label>Etiquetas</Label>
                <div className="flex flex-wrap gap-2">
                  {etiquetas.map((etiqueta) => (
                    <EtiquetaToggle
                      key={etiqueta.id}
                      etiqueta={etiqueta}
                      ativa={etiquetasDoForm.includes(etiqueta.id)}
                      onClick={() => alternarEtiquetaNoForm(etiqueta.id)}
                    />
                  ))}
                </div>
              </div>
            )}
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

      {/* Gerenciar etiquetas */}
      <Dialog open={gerenciandoEtiquetas} onOpenChange={setGerenciandoEtiquetas}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Etiquetas</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {etiquetas.length > 0 && (
              <div className="space-y-2">
                {etiquetas.map((etiqueta) => (
                  <div key={etiqueta.id} className="flex items-center justify-between gap-2">
                    <EtiquetaBadge etiqueta={etiqueta} />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => removerEtiqueta(etiqueta.id)}
                    >
                      Remover
                    </Button>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Remover a etiqueta não apaga nenhuma cliente — elas só deixam de tê-la.
                </p>
              </div>
            )}

            {sugestoesRestantes.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Sugestões</Label>
                  {sugestoesRestantes.length > 1 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={criarTodasAsSugestoes}
                      disabled={criandoEtiquetas}
                    >
                      {criandoEtiquetas
                        ? 'Adicionando...'
                        : `Adicionar todas (${sugestoesRestantes.length})`}
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {sugestoesRestantes.map((s) => (
                    <Button
                      key={s.nome}
                      variant="outline"
                      size="sm"
                      onClick={() => criarEtiqueta(s.nome, s.cor)}
                    >
                      <Plus className="mr-1 h-3 w-3" /> {s.nome}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="nova-etiqueta">Criar a minha</Label>
              <div className="flex gap-2">
                <Input
                  id="nova-etiqueta"
                  value={novaEtiqueta}
                  placeholder="Ex.: Sem comprar há 6 meses"
                  onChange={(e) => setNovaEtiqueta(e.target.value)}
                />
                <Button type="button" onClick={() => criarEtiqueta(novaEtiqueta, novaCor)}>
                  Criar
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {CORES_ETIQUETA.map((cor) => (
                  <EtiquetaToggle
                    key={cor}
                    etiqueta={{ id: cor, nome: NOME_DA_COR[cor], cor }}
                    ativa={novaCor === cor}
                    onClick={() => setNovaCor(cor)}
                  />
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Prévia antes de gravar */}
      <Dialog open={previa !== null} onOpenChange={(aberto) => !aberto && setPrevia(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conferir antes de importar</DialogTitle>
          </DialogHeader>
          {previa && previa.nomes.length === 0 ? (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {previa.ignoradas[0] || 'Não encontrei nenhuma cliente nessa planilha.'}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm">
                <strong>{previa?.nomes.length}</strong> cliente(s) encontrada(s) na planilha.
              </p>
              {previa && previa.ignoradas.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  Estas colunas não foram reconhecidas e serão ignoradas:{' '}
                  <strong>{previa.ignoradas.join(', ')}</strong>. O resto será importado normalmente.
                </div>
              )}
              <div className="max-h-48 overflow-y-auto rounded-md border">
                <ul className="divide-y text-sm">
                  {previa?.nomes.slice(0, 50).map((nome, i) => (
                    <li key={i} className="px-3 py-1.5">{nome}</li>
                  ))}
                </ul>
              </div>
              {previa && previa.nomes.length > 50 && (
                <p className="text-xs text-muted-foreground">
                  Mostrando as 50 primeiras — todas serão importadas.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Quem já estiver na sua base (mesmo telefone) será atualizada, não duplicada. Campos
                que você já preencheu à mão não são sobrescritos.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrevia(null)}>
              Cancelar
            </Button>
            {previa && previa.nomes.length > 0 && (
              <Button onClick={confirmarImportacao} disabled={importando}>
                {importando ? 'Importando...' : `Importar ${previa.nomes.length}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resultado */}
      <Dialog
        open={resultadoImport !== null}
        onOpenChange={(aberto) => !aberto && setResultadoImport(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importação concluída</DialogTitle>
          </DialogHeader>
          {resultadoImport && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Novas</p>
                  <p className="text-2xl font-bold">{resultadoImport.criadas}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Atualizadas</p>
                  <p className="text-2xl font-bold">{resultadoImport.atualizadas}</p>
                </div>
              </div>
              {resultadoImport.etiquetasCriadas.length > 0 && (
                <p className="text-muted-foreground">
                  Etiquetas criadas: {resultadoImport.etiquetasCriadas.join(', ')}
                </p>
              )}
              {resultadoImport.ignoradas.length > 0 && (
                <div className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
                  <p className="font-medium">
                    {resultadoImport.ignoradas.length} linha(s) não entraram:
                  </p>
                  <ul className="list-inside list-disc">
                    {resultadoImport.ignoradas.map((item, i) => (
                      <li key={i}>
                        Linha {item.linha} ({item.nome || 'sem nome'}): {item.motivo}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setResultadoImport(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Como preparar a planilha. A Tania vai ensinar isso ao vivo, entao a
          instrucao mora dentro do produto e nao num documento a parte. */}
      <Dialog open={mostrandoAjudaCSV} onOpenChange={setMostrandoAjudaCSV}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Como preparar a planilha</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 text-sm">
            <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="font-semibold">Comece pelo modelo</p>
              <p className="text-muted-foreground">
                Baixe o arquivo pronto, abra no Excel ou no Google Sheets, preencha e importe de
                volta. Ele já vem com as colunas certas e duas linhas de exemplo —{' '}
                <strong>apague as duas antes de importar</strong>, senão elas entram como clientes.
              </p>
              <Button onClick={baixarModelo} className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" /> Baixar modelo (.csv)
              </Button>
            </div>

            <div className="space-y-2">
              <p className="font-semibold">1. Salve como CSV</p>
              <p className="text-muted-foreground">
                No Excel: <strong>Arquivo → Salvar como → CSV</strong>. No Google Sheets:{' '}
                <strong>Arquivo → Fazer download → CSV</strong>. Vírgula ou ponto e vírgula, tanto
                faz — o sistema descobre sozinho.
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-semibold">2. Use estes nomes de coluna</p>
              <p className="text-muted-foreground">
                A ordem não importa, e maiúscula e acento também não. Só o <strong>nome</strong> é
                obrigatório.
              </p>
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Coluna</th>
                      <th className="px-3 py-2 font-semibold">Também aceita</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[
                      ['nome *', 'cliente, nome completo, name'],
                      ['telefone', 'celular, whatsapp, fone, tel, contato, número'],
                      ['email', 'mail'],
                      ['aniversário', 'nascimento, data de nascimento'],
                      ['etiquetas', 'etiqueta, tags, marcadores, categoria'],
                      ['contexto', 'observações, obs, notas, anotações, histórico'],
                    ].map(([coluna, sinonimos]) => (
                      <tr key={coluna}>
                        <td className="px-3 py-2 font-medium">{coluna}</td>
                        <td className="px-3 py-2 text-muted-foreground">{sinonimos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Coluna que o sistema não reconhecer não é descartada em silêncio: ela aparece
                avisada na tela de conferência, antes de gravar.
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-semibold">3. Como preencher</p>
              <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
                <li>
                  <strong>Aniversário:</strong> 25/12/1990 ou 1990-12-25.
                </li>
                <li>
                  <strong>Telefone:</strong> pode vir formatado, com ou sem DDD e +55. O sistema
                  guarda só os números.
                </li>
                <li>
                  <strong>Mais de uma etiqueta na mesma célula:</strong> separe por ponto e vírgula
                  — <em>Cliente VIP; Dia das Mães</em>. Etiqueta que ainda não existe é criada.
                </li>
                <li>Linha sem nome é pulada e reportada com o número dela, o resto entra normal.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="font-semibold">4. O que acontece com quem já está aqui</p>
              <p className="text-muted-foreground">
                Quem já existe é encontrada pelo <strong>telefone</strong> e{' '}
                <strong>atualizada, não duplicada</strong> — e só os campos vazios são preenchidos.
                O que você escreveu à mão nunca é sobrescrito, então reimportar a mesma planilha é
                seguro.
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              <strong>Exportar</strong> gera um arquivo no mesmo formato, mas com as suas clientes
              de verdade — serve pra fazer backup ou editar tudo de uma vez na planilha e trazer de
              volta.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setMostrandoAjudaCSV(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
