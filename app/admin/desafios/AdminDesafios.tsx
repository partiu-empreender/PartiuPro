'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Hammer, Pencil, Plus, Trash2, X } from 'lucide-react';
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
import PageShell from '@/components/shared/PageShell';
import PageHeader from '@/components/shared/PageHeader';
import { hojeBrasil } from '@/lib/datas';
import { situacaoDoDesafio, type Desafio } from '@/lib/desafios';
import { cn } from '@/lib/utils';

interface DesafioDoAdmin extends Desafio {
  comecaram: number;
  concluiram: number;
}

interface Formulario {
  titulo: string;
  descricao: string;
  inicio: string;
  fim: string;
  publicado: boolean;
  /** `id` só nas tarefas que já existem: é ele que preserva o check das alunas. */
  tarefas: { id?: string; texto: string }[];
}

const vazio = (): Formulario => ({
  titulo: '',
  descricao: '',
  inicio: hojeBrasil(),
  fim: '',
  publicado: false,
  tarefas: [{ texto: '' }],
});

const dataBR = (iso: string) => iso.split('-').reverse().join('/');

const CLASSE_TEXTAREA =
  'flex min-h-[6rem] w-full rounded-xl border border-input bg-white/70 px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30';

const ROTULO_SITUACAO = { 'em-breve': 'Começa em breve', aberto: 'Aberto', encerrado: 'Encerrado' } as const;

/**
 * Onde a equipe cria os desafios do Mão na Massa. Nasce como rascunho; só
 * aparece pras alunas depois de marcado como publicado.
 */
export default function AdminDesafios() {
  const hoje = hojeBrasil();
  const [desafios, setDesafios] = useState<DesafioDoAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<DesafioDoAdmin | 'novo' | null>(null);
  const [form, setForm] = useState<Formulario>(vazio);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState<DesafioDoAdmin | null>(null);

  const carregar = async () => {
    try {
      const res = await fetch('/api/admin/desafios');
      const dados = await res.json();
      if (!res.ok) throw new Error(dados.error);
      setDesafios(dados.data || []);
    } catch (error) {
      console.error('Erro ao carregar desafios:', error);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const abrir = (desafio: DesafioDoAdmin | 'novo') => {
    setErro('');
    setForm(
      desafio === 'novo'
        ? vazio()
        : {
            titulo: desafio.titulo,
            descricao: desafio.descricao ?? '',
            inicio: desafio.inicio,
            fim: desafio.fim ?? '',
            publicado: desafio.publicado,
            tarefas: desafio.tarefas.map((t) => ({ id: t.id, texto: t.texto })),
          },
    );
    setEditando(desafio);
  };

  const salvar = async () => {
    setErro('');
    setSalvando(true);
    try {
      const existente = editando && editando !== 'novo' ? editando : null;
      const res = await fetch(
        existente ? `/api/admin/desafios?id=${encodeURIComponent(existente.id)}` : '/api/admin/desafios',
        {
          method: existente ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, fim: form.fim || null }),
        },
      );
      const dados = await res.json();
      if (!res.ok) throw new Error(dados.error || 'Erro ao salvar');
      setEditando(null);
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (!excluindo) return;
    setSalvando(true);
    try {
      const res = await fetch(`/api/admin/desafios?id=${encodeURIComponent(excluindo.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setExcluindo(null);
      await carregar();
    } catch {
      setErro('Não deu pra excluir. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  const mudarTarefa = (indice: number, texto: string) =>
    setForm((f) => ({ ...f, tarefas: f.tarefas.map((t, i) => (i === indice ? { ...t, texto } : t)) }));

  return (
    <PageShell>
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Painel administrativo
      </Link>
      <PageHeader
        title="Desafios — Mão na Massa"
        description="Crie o desafio, coloque as tarefas e publique. Rascunho não aparece pras alunas."
        action={
          <Button onClick={() => abrir('novo')} className="gap-2">
            <Plus className="h-4 w-4" /> Novo desafio
          </Button>
        }
      />

      <section className="vidro rounded-[1.75rem] p-5">
        {desafios.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {carregando ? 'Carregando...' : 'Nenhum desafio ainda. Crie o primeiro.'}
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {desafios.map((d) => {
              const situacao = situacaoDoDesafio(d, hoje);
              return (
                <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Hammer className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{d.titulo}</p>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-medium',
                          d.publicado ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {d.publicado ? ROTULO_SITUACAO[situacao] : 'Rascunho'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {dataBR(d.inicio)}
                      {d.fim ? ` a ${dataBR(d.fim)}` : ', sem prazo'} · {d.tarefas.length}{' '}
                      {d.tarefas.length === 1 ? 'tarefa' : 'tarefas'} · {d.comecaram}{' '}
                      {d.comecaram === 1 ? 'aluna começou' : 'alunas começaram'}, {d.concluiram} concluí
                      {d.concluiram === 1 ? 'u' : 'ram'}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => abrir(d)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Excluir" onClick={() => setExcluindo(d)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog open={editando !== null} onOpenChange={(abrirDialogo) => !abrirDialogo && setEditando(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando === 'novo' ? 'Novo desafio' : 'Editar desafio'}</DialogTitle>
            <DialogDescription>As alunas marcam cada tarefa como feita.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="des-titulo">Nome do desafio</Label>
              <Input
                id="des-titulo"
                placeholder="Ex.: 7 dias de stories vendedores"
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="des-descricao">Explicação (opcional)</Label>
              <textarea
                id="des-descricao"
                className={CLASSE_TEXTAREA}
                placeholder="O objetivo do desafio e como fazer"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="des-inicio">Começa em</Label>
                <Input
                  id="des-inicio"
                  type="date"
                  value={form.inicio}
                  onChange={(e) => setForm((f) => ({ ...f, inicio: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="des-fim">Prazo (opcional)</Label>
                <Input
                  id="des-fim"
                  type="date"
                  value={form.fim}
                  min={form.inicio}
                  onChange={(e) => setForm((f) => ({ ...f, fim: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tarefas</Label>
              {form.tarefas.map((tarefa, i) => (
                <div key={tarefa.id ?? `nova-${i}`} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-right text-sm text-muted-foreground">{i + 1}.</span>
                  <Input
                    value={tarefa.texto}
                    placeholder="O que a aluna precisa fazer"
                    onChange={(e) => mudarTarefa(i, e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Tirar tarefa"
                    disabled={form.tarefas.length === 1}
                    onClick={() => setForm((f) => ({ ...f, tarefas: f.tarefas.filter((_, j) => j !== i) }))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setForm((f) => ({ ...f, tarefas: [...f.tarefas, { texto: '' }] }))}
              >
                <Plus className="h-4 w-4" /> Mais uma tarefa
              </Button>
              {editando !== 'novo' && (
                <p className="text-xs text-muted-foreground">
                  Corrigir o texto de uma tarefa mantém o check de quem já fez. Tirar uma tarefa apaga o
                  check dela.
                </p>
              )}
            </div>

            <label className="flex items-start gap-3 rounded-2xl border bg-white/60 p-3">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 accent-[hsl(var(--primary))]"
                checked={form.publicado}
                onChange={(e) => setForm((f) => ({ ...f, publicado: e.target.checked }))}
              />
              <span className="text-sm">
                <span className="font-medium">Publicar pras alunas</span>
                <span className="block text-xs text-muted-foreground">
                  Desmarcado, fica como rascunho e ninguém vê.
                </span>
              </span>
            </label>

            {erro && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={excluindo !== null} onOpenChange={(abrirDialogo) => !abrirDialogo && setExcluindo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir desafio?</DialogTitle>
            <DialogDescription>
              &quot;{excluindo?.titulo}&quot; some do Mão na Massa, junto com o progresso das alunas nele.
            </DialogDescription>
          </DialogHeader>
          {erro && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluindo(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={excluir} disabled={salvando}>
              {salvando ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
