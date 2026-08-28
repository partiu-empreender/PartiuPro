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
import { Download, Plus, Search, Tag, Upload, Users } from 'lucide-react';
import PageShell from '@/components/shared/PageShell';
import PageHeader from '@/components/shared/PageHeader';
import EtiquetaBadge, {
  EtiquetaToggle,
  CORES_ETIQUETA,
  type CorEtiqueta,
  type Etiqueta,
} from '@/components/shared/EtiquetaBadge';
import { formatarTelefone } from '@/lib/telefone';
import { lerCSV } from '@/lib/csv';
import { cn } from '@/lib/utils';

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

// Sugestões pra tela não abrir vazia na primeira vez. A Tania vai mandar a
// lista definitiva dela; estas são só um ponto de partida, e ela pode apagar.
const SUGESTOES: { nome: string; cor: CorEtiqueta }[] = [
  { nome: 'VIP', cor: 'amber' },
  { nome: 'Aniversário', cor: 'rose' },
  { nome: 'Natal', cor: 'emerald' },
  { nome: 'Dia das Mães', cor: 'violet' },
  { nome: 'Corporativo', cor: 'sky' },
  { nome: 'Prospecção', cor: 'slate' },
];

interface ResultadoImportacao {
  criadas: number;
  atualizadas: number;
  ignoradas: { linha: number; nome: string; motivo: string }[];
  colunasIgnoradas: string[];
  etiquetasCriadas: string[];
}

const formVazio = { name: '', phone: '', email: '', notes: '', date_of_birth: '' };

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [loading, setLoading] = useState(true);
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

  const sugestoesRestantes = SUGESTOES.filter(
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
              <Upload className="mr-2 h-4 w-4" /> Importar
            </Button>
            <a href="/api/clientes/exportar">
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" /> Exportar
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
                : 'border-input bg-background text-muted-foreground hover:bg-accent',
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
      </div>

      {loading ? (
        <p className="py-8 text-center text-muted-foreground">Carregando...</p>
      ) : clientes.length === 0 ? (
        <Card className="mx-auto max-w-md">
          <CardContent className="space-y-4 p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {busca || filtroEtiqueta
                ? 'Nenhuma cliente encontrada com esse filtro.'
                : 'Sua base de clientes é o seu maior ativo. Cadastre a primeira — ou registre uma venda com o nome e o telefone, que ela entra aqui sozinha.'}
            </p>
            {!busca && !filtroEtiqueta && (
              <Button onClick={abrirNovo} className="w-full">
                <Plus className="mr-2 h-4 w-4" /> Cadastrar minha primeira cliente
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {clientes.length} cliente{clientes.length > 1 ? 's' : ''}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clientes.map((cliente) => (
              <Card key={cliente.id} className="transition-colors hover:bg-muted/40">
                <CardContent className="space-y-3 p-5">
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
              <Label htmlFor="cliente-nome">Nome</Label>
              <Input
                id="cliente-nome"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cliente-telefone">Telefone</Label>
                <Input
                  id="cliente-telefone"
                  inputMode="tel"
                  placeholder="(21) 99999-8888"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
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
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Comprou cesta de maternidade. O pai faleceu em maio."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                O que você quer lembrar na próxima conversa.
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
                <Label>Sugestões</Label>
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
                    etiqueta={{ id: cor, nome: cor, cor }}
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
    </PageShell>
  );
}
