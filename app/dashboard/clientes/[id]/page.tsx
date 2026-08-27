'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageCircle, Trash2 } from 'lucide-react';
import PageShell from '@/components/shared/PageShell';
import EtiquetaBadge, { type Etiqueta } from '@/components/shared/EtiquetaBadge';
import { formatarTelefone, linkWhatsApp } from '@/lib/telefone';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ItemCompra {
  produto_nome: string;
  quantidade: number;
  subtotal: number;
  tipo: string;
}

interface Compra {
  id: string;
  data: string;
  faturamento_total: number;
  venda_itens: ItemCompra[];
}

interface ClienteDetalhe {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  date_of_birth: string | null;
  total_orders: number | null;
  total_spent: number | null;
  last_order_at: string | null;
  etiquetas: Etiqueta[];
  compras: Compra[];
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// A data vem como YYYY-MM-DD (coluna DATE). Montar com T12:00 evita que o
// fuso do navegador jogue a data pro dia anterior na exibição.
const fmtData = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR');

export default function ClienteDetalhePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [cliente, setCliente] = useState<ClienteDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/clientes/${params.id}`);
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Erro ao carregar cliente');
        setCliente(result.data);
      } catch (error) {
        setErro(error instanceof Error ? error.message : 'Erro ao carregar cliente');
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  const excluir = async () => {
    await fetch(`/api/clientes/${params.id}`, { method: 'DELETE' });
    router.push('/dashboard/clientes');
    router.refresh();
  };

  if (loading) {
    return (
      <PageShell width="narrow">
        <p className="py-8 text-center text-muted-foreground">Carregando...</p>
      </PageShell>
    );
  }

  if (erro || !cliente) {
    return (
      <PageShell width="narrow">
        <p className="py-8 text-center text-destructive">{erro || 'Cliente não encontrada'}</p>
      </PageShell>
    );
  }

  const whatsapp = linkWhatsApp(cliente.phone);

  return (
    <PageShell width="narrow">
      <div>
        <Link
          href="/dashboard/clientes"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para minhas clientes
        </Link>
        <h1 className="text-2xl font-bold sm:text-3xl">{cliente.name}</h1>
        {cliente.phone && (
          <p className="mt-1 text-muted-foreground">{formatarTelefone(cliente.phone)}</p>
        )}
        {cliente.etiquetas.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {cliente.etiquetas.map((etiqueta) => (
              <EtiquetaBadge key={etiqueta.id} etiqueta={etiqueta} />
            ))}
          </div>
        )}
      </div>

      {whatsapp && (
        <a href={whatsapp} target="_blank" rel="noopener noreferrer">
          <Button className="w-full sm:w-auto">
            <MessageCircle className="mr-2 h-4 w-4" /> Conversar no WhatsApp
          </Button>
        </a>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Compras</p>
            <p className="text-2xl font-bold">{cliente.total_orders || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total gasto</p>
            <p className="text-2xl font-bold">{brl(cliente.total_spent || 0)}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Última compra</p>
            <p className="text-2xl font-bold">
              {cliente.last_order_at
                ? new Date(cliente.last_order_at).toLocaleDateString('pt-BR')
                : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {cliente.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Contexto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{cliente.notes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Histórico de compras</CardTitle>
        </CardHeader>
        <CardContent>
          {cliente.compras.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma compra vinculada ainda. Ao registrar uma venda, escolha esta cliente pra que a
              compra apareça aqui.
            </p>
          ) : (
            <div className="space-y-4">
              {cliente.compras.map((compra) => (
                <div key={compra.id} className="border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{fmtData(compra.data)}</span>
                    <span className="font-bold">{brl(compra.faturamento_total)}</span>
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {(compra.venda_itens || []).map((item, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        {item.quantidade}× {item.produto_nome}
                        {item.tipo === 'adicional' && (
                          <span className="ml-1 text-xs">(adicional)</span>
                        )}{' '}
                        · {brl(item.subtotal)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="pt-2">
        <button
          type="button"
          onClick={() => setConfirmandoExclusao(true)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" /> Excluir esta cliente
        </button>
      </div>

      <Dialog open={confirmandoExclusao} onOpenChange={setConfirmandoExclusao}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir {cliente.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O cadastro e as etiquetas dela serão apagados. As vendas já registradas continuam no seu
            faturamento, mas deixam de ficar ligadas a ela.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmandoExclusao(false)}>
              Cancelar
            </Button>
            <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={excluir}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
