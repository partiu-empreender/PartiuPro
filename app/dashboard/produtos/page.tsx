'use client';

import { useEffect, useState } from 'react';
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
import { Pencil, Plus, Trash2 } from 'lucide-react';
import PageShell from '@/components/shared/PageShell';
import PageHeader from '@/components/shared/PageHeader';

type TipoProduto = 'produto' | 'adicional';

interface Produto {
  id: string;
  name: string;
  price: number;
  cost: number;
  tipo: TipoProduto;
}

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ROTULOS: Record<TipoProduto, { singular: string; plural: string; ajuda: string }> = {
  produto: {
    singular: 'produto',
    plural: 'Produtos',
    ajuda: 'O item principal da venda — cesta de café da manhã, tábua de frios.',
  },
  adicional: {
    singular: 'adicional',
    plural: 'Adicionais',
    ajuda: 'O que vai junto do produto — buquê, arranjo, orquídea.',
  },
};

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Produto | null>(null);
  const [form, setForm] = useState<{ name: string; price: string; cost: string; tipo: TipoProduto }>({
    name: '',
    price: '',
    cost: '',
    tipo: 'produto',
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/produtos');
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao carregar produtos');
      setProdutos(result.data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const abrirNovo = (tipo: TipoProduto = 'produto') => {
    setEditando(null);
    setForm({ name: '', price: '', cost: '', tipo });
    setErro('');
    setAberto(true);
  };

  const abrirEdicao = (p: Produto) => {
    setEditando(p);
    setForm({ name: p.name, price: String(p.price), cost: String(p.cost), tipo: p.tipo ?? 'produto' });
    setErro('');
    setAberto(true);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    const price = parseFloat(form.price);
    const cost = parseFloat(form.cost) || 0;

    if (!form.name.trim()) {
      setErro(`Informe o nome do ${ROTULOS[form.tipo].singular}.`);
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setErro('O preço precisa ser maior que zero.');
      return;
    }
    if (cost > price) {
      setErro('O custo não pode ser maior que o preço.');
      return;
    }

    setSalvando(true);
    try {
      const url = editando ? `/api/produtos/${editando.id}` : '/api/produtos';
      const method = editando ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), price, cost, tipo: form.tipo }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao salvar produto');
      setAberto(false);
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao salvar produto');
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (id: string) => {
    await fetch(`/api/produtos/${id}`, { method: 'DELETE' });
    await carregar();
  };

  const cartao = (p: Produto) => {
    const lucro = p.price - p.cost;
    const margem = p.price > 0 ? (lucro / p.price) * 100 : 0;
    return (
      <Card key={p.id}>
        <CardContent className="space-y-4 p-6">
          <h3 className="truncate text-lg font-bold">{p.name}</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between border-b pb-2">
              <dt className="text-muted-foreground">Preço</dt>
              <dd className="font-bold">{brl(p.price)}</dd>
            </div>
            <div className="flex justify-between border-b pb-2">
              <dt className="text-muted-foreground">Custo</dt>
              <dd className="font-bold">{brl(p.cost)}</dd>
            </div>
            <div className="flex justify-between border-b pb-2">
              <dt className="text-muted-foreground">Margem</dt>
              <dd className="font-bold">{margem.toFixed(0)}%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Lucro unitário</dt>
              <dd className="font-bold">{brl(lucro)}</dd>
            </div>
          </dl>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => abrirEdicao(p)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10"
              aria-label={`Excluir ${p.name}`}
              onClick={() => remover(p.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const secao = (tipo: TipoProduto) => {
    const itens = produtos.filter((p) => (p.tipo ?? 'produto') === tipo);
    const rotulo = ROTULOS[tipo];
    return (
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b pb-3">
          <div>
            <h2 className="text-xl font-bold">
              {rotulo.plural}{' '}
              <span className="text-base font-normal text-muted-foreground">({itens.length})</span>
            </h2>
            <p className="text-sm text-muted-foreground">{rotulo.ajuda}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => abrirNovo(tipo)}>
            <Plus className="mr-2 h-4 w-4" /> Novo {rotulo.singular}
          </Button>
        </div>
        {itens.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Nenhum {rotulo.singular} cadastrado ainda.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{itens.map(cartao)}</div>
        )}
      </section>
    );
  };

  return (
    <PageShell>
      <PageHeader
        title="Meu catálogo"
        description="Produtos e adicionais, com preço, custo, margem e lucro unitário."
        action={
          <Button onClick={() => abrirNovo('produto')} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Novo produto
          </Button>
        }
      />

      {loading ? (
        <p className="text-center py-8 text-muted-foreground">Carregando...</p>
      ) : produtos.length === 0 ? (
        <Card className="mx-auto max-w-md">
          <CardContent className="space-y-4 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Você ainda não cadastrou nada. Cadastre suas cestas pra calcular margem e agilizar o registro
              de vendas — e depois os adicionais, pra medir quanto eles trazem de faturamento.
            </p>
            <Button onClick={() => abrirNovo('produto')} className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Cadastrar meu primeiro produto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          {secao('produto')}
          {secao('adicional')}
        </div>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editando ? 'Editar' : 'Novo'} {ROTULOS[form.tipo].singular}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            {erro && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {erro}
              </div>
            )}
            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['produto', 'adicional'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={form.tipo === t}
                    onClick={() => setForm((f) => ({ ...f, tipo: t }))}
                    className={
                      form.tipo === t
                        ? 'rounded-md border border-primary bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground'
                        : 'rounded-md border bg-background px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent'
                    }
                  >
                    {ROTULOS[t].plural.replace(/s$/, '')}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{ROTULOS[form.tipo].ajuda}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="preco">Preço (R$)</Label>
                <Input
                  id="preco"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custo">Custo (R$)</Label>
                <Input
                  id="custo"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.cost}
                  onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                />
              </div>
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
