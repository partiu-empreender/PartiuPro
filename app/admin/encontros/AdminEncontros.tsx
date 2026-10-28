'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Pencil, Plus, Trash2, Video } from 'lucide-react';
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
import { horaCurta, momentoDoEncontro, partesEmBrasilia, type Encontro } from '@/lib/agenda';

interface Formulario {
  titulo: string;
  data: string;
  hora: string;
  duracao_minutos: string;
  link: string;
  descricao: string;
}

const vazio = (): Formulario => ({
  titulo: '',
  data: hojeBrasil(),
  hora: '19:00',
  duracao_minutos: '60',
  link: '',
  descricao: '',
});

const CLASSE_TEXTAREA =
  'flex min-h-[6rem] w-full rounded-xl border border-input bg-white/70 px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30';

/**
 * Onde a equipe cadastra os encontros da mentoria. Eles aparecem na Agenda
 * de todas as alunas, no cartão "Próximo encontro" da home e no sininho no
 * dia do encontro.
 */
export default function AdminEncontros() {
  const [encontros, setEncontros] = useState<Encontro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<Encontro | 'novo' | null>(null);
  const [form, setForm] = useState<Formulario>(vazio);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState<Encontro | null>(null);

  const carregar = async () => {
    try {
      const res = await fetch('/api/admin/encontros');
      const dados = await res.json();
      if (!res.ok) throw new Error(dados.error);
      setEncontros(dados.data || []);
    } catch (error) {
      console.error('Erro ao carregar encontros:', error);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const abrir = (encontro: Encontro | 'novo') => {
    setErro('');
    if (encontro === 'novo') {
      setForm(vazio());
    } else {
      const { data, hora } = partesEmBrasilia(encontro.inicio);
      setForm({
        titulo: encontro.titulo,
        data,
        hora,
        duracao_minutos: String(encontro.duracao_minutos),
        link: encontro.link ?? '',
        descricao: encontro.descricao ?? '',
      });
    }
    setEditando(encontro);
  };

  const salvar = async () => {
    setErro('');
    setSalvando(true);
    try {
      const url =
        editando && editando !== 'novo'
          ? `/api/admin/encontros?id=${encodeURIComponent(editando.id)}`
          : '/api/admin/encontros';
      const res = await fetch(url, {
        method: editando && editando !== 'novo' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, duracao_minutos: Number(form.duracao_minutos) }),
      });
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
      const res = await fetch(`/api/admin/encontros?id=${encodeURIComponent(excluindo.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      setExcluindo(null);
      await carregar();
    } catch {
      setErro('Não deu pra excluir. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  const proximos = encontros
    .filter((e) => momentoDoEncontro(e.inicio, e.duracao_minutos) !== 'passou')
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  const passados = encontros.filter((e) => momentoDoEncontro(e.inicio, e.duracao_minutos) === 'passou');

  const campo = (chave: keyof Formulario) => ({
    value: form[chave],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [chave]: e.target.value })),
  });

  return (
    <PageShell>
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Painel administrativo
      </Link>
      <PageHeader
        title="Encontros da mentoria"
        description="O que você cadastrar aqui aparece na Agenda de todas as alunas e na home."
        action={
          <Button onClick={() => abrir('novo')} className="gap-2">
            <Plus className="h-4 w-4" /> Novo encontro
          </Button>
        }
      />

      {[
        { titulo: 'Próximos', lista: proximos, vazio: 'Nenhum encontro marcado. Cadastre o primeiro.' },
        { titulo: 'Já aconteceram', lista: passados, vazio: '' },
      ].map(
        (grupo) =>
          (grupo.lista.length > 0 || grupo.vazio) && (
            <section key={grupo.titulo} className="vidro rounded-[1.75rem] p-5">
              <h2 className="text-lg font-semibold">{grupo.titulo}</h2>
              {grupo.lista.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">{carregando ? 'Carregando...' : grupo.vazio}</p>
              ) : (
                <ul className="mt-3 divide-y divide-border/60">
                  {grupo.lista.map((e) => {
                    const { data } = partesEmBrasilia(e.inicio);
                    return (
                      <li key={e.id} className="flex items-center gap-3 py-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Video className="h-[18px] w-[18px]" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{e.titulo}</p>
                          <p className="text-xs text-muted-foreground">
                            {data.split('-').reverse().join('/')} às {horaCurta(e.inicio)} ·{' '}
                            {e.duracao_minutos} min · {e.link ? 'com link da sala' : 'sem link ainda'}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => abrir(e)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Excluir" onClick={() => setExcluindo(e)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ),
      )}

      <Dialog open={editando !== null} onOpenChange={(abrirDialogo) => !abrirDialogo && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando === 'novo' ? 'Novo encontro' : 'Editar encontro'}</DialogTitle>
            <DialogDescription>Horário de Brasília.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="enc-titulo">Nome do encontro</Label>
              <Input id="enc-titulo" placeholder="Ex.: Encontro ao vivo — precificação" {...campo('titulo')} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="enc-data">Data</Label>
                <Input id="enc-data" type="date" {...campo('data')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="enc-hora">Horário</Label>
                <Input id="enc-hora" type="time" {...campo('hora')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="enc-duracao">Duração (min)</Label>
                <Input id="enc-duracao" type="number" min={5} max={600} step={5} {...campo('duracao_minutos')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enc-link">Link da sala (opcional)</Label>
              <Input id="enc-link" type="url" placeholder="https://meet.google.com/..." {...campo('link')} />
              <p className="text-xs text-muted-foreground">
                As alunas veem o botão &quot;Entrar na sala&quot; 15 minutos antes do início.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enc-descricao">Descrição (opcional)</Label>
              <textarea id="enc-descricao" className={CLASSE_TEXTAREA} placeholder="O que vai rolar no encontro" {...campo('descricao')} />
            </div>
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
            <DialogTitle>Excluir encontro?</DialogTitle>
            <DialogDescription>
              &quot;{excluindo?.titulo}&quot; some da agenda de todas as alunas.
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
